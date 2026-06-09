/**
 * POST /api/content/assistant/label-uploads
 *
 * Applies the OPERATOR's name / description / intended-use to freshly-uploaded
 * library assets. The operator types their answer in chat; this route uses the LLM
 * ONLY to structure that human answer into the three fields (it never invents
 * content — if the operator didn't say something, the field stays empty). For a
 * batch (>1 asset) the same answer is applied to every asset with a numeric suffix
 * on the name ("Velocity Battle Pose 1", "… 2", …).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { updateAsset } from '@/lib/media/media-library-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/assistant/label-uploads/route.ts';

const BodySchema = z.object({
  assets: z
    .array(z.object({ id: z.string().min(1), fileName: z.string().default('') }))
    .min(1),
  /** The operator's free-text answer to "name / description / intended use?". */
  reply: z.string().min(1),
});

const LabelSchema = z.object({
  /** The project these assets belong to — the grouping key the operator searches by. */
  projectName: z.string().default(''),
  description: z.string().default(''),
  intendedUse: z.string().default(''),
});

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (m) => (m.includes('```') ? '' : m))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { assets, reply } = parsed.data;

    // Structure the operator's answer into the three fields. The LLM ONLY parses
    // what the human wrote — it must not invent a name, description, or use.
    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content:
            'You extract three fields from what a human typed about file(s) they uploaded for a project: ' +
            'projectName (the project these assets belong to), description (what they are), and intendedUse ' +
            '(what they are used for). Use ONLY the human\'s words — never invent, embellish, or guess. If the ' +
            'human did not give one of the fields, return an empty string for it. Respond with ONLY a JSON ' +
            'object: {"projectName": string, "description": string, "intendedUse": string}. No prose, no fences.',
        },
        {
          role: 'user',
          content:
            `The human uploaded ${assets.length} file(s)` +
            `${assets.length > 1 ? ' (a batch — one answer applies to all)' : ` named "${assets[0]?.fileName ?? ''}"`}.\n` +
            `Their answer:\n${reply}`,
        },
      ],
      temperature: 0,
      maxTokens: 600,
    });

    let label: z.infer<typeof LabelSchema>;
    try {
      label = LabelSchema.parse(JSON.parse(stripJsonFences(response.content ?? '')));
    } catch {
      // Fall back to using the raw reply as the description so nothing is lost.
      label = { projectName: '', description: reply.trim(), intendedUse: '' };
    }

    const project = label.projectName.trim();
    const applied: Array<{ id: string; name: string; project: string }> = [];

    for (const asset of assets) {
      // Use the file's real basename (strip any folder path from a folder upload).
      const base = asset.fileName.split(/[\\/]/).pop() ?? asset.fileName;
      const name = base.length > 0 ? base : 'Untitled';
      await updateAsset(asset.id, {
        name,
        // Project name is stored as a tag so the operator can filter the whole
        // library down to one project by searching its name.
        tags: ['reference-material', ...(project ? [project] : [])],
        ...(label.description.trim() ? { description: label.description.trim() } : {}),
        ...(label.intendedUse.trim() ? { intendedUse: label.intendedUse.trim() } : {}),
      });
      applied.push({ id: asset.id, name, project });
    }

    logger.info('[label-uploads] applied operator labels', { count: applied.length, project, file: FILE });
    return NextResponse.json({ success: true, project, applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to label uploads';
    logger.error('[label-uploads] failed', error instanceof Error ? error : new Error(message), { file: FILE });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
