'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { PageTitle, SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Shapes returned by GET /api/agent/knowledge/[agentId] ───────────────────
interface KBDocument {
  id: string;
  filename: string;
  type: string;
  assetType: 'document' | 'example' | 'reference';
  uploadedAt: string;
  chars: number;
}
interface KBUrl { id: string; url: string; title: string; addedAt: string }
interface KBFaq { id: string; question: string; category: string | null }
// successResponse() returns a FLAT envelope: { success: true, ...data }.
interface KBResponse {
  success?: boolean;
  agentId?: string;
  agentName?: string;
  documents?: KBDocument[];
  urls?: KBUrl[];
  faqs?: KBFaq[];
  counts?: { documents: number; urls: number; faqs: number };
  error?: string;
}

type AssetType = 'document' | 'example' | 'reference';
const ASSET_LABELS: Record<AssetType, string> = {
  document: 'Reference document',
  example: 'Example of good work',
  reference: 'Background reference',
};

export default function AgentKnowledgePage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [agentName, setAgentName] = useState(agentId);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [urls, setUrls] = useState<KBUrl[]>([]);
  const [faqs, setFaqs] = useState<KBFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload form state
  const [files, setFiles] = useState<File[]>([]);
  const [assetType, setAssetType] = useState<AssetType>('document');
  const [urlList, setUrlList] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [faqText, setFaqText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Two-step delete arming (memory rule: destructive actions need two clicks)
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/agent/knowledge/${encodeURIComponent(agentId)}`);
      const json = (await res.json()) as KBResponse;
      if (!res.ok || !json.success) {
        setMessage({ type: 'error', text: json.error ?? 'Could not load this agent\'s knowledge.' });
        return;
      }
      setAgentName(json.agentName ?? agentId);
      setDocuments(json.documents ?? []);
      setUrls(json.urls ?? []);
      setFaqs(json.faqs ?? []);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Could not load knowledge.' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, agentId]);

  useEffect(() => { void load(); }, [load]);

  const hasSomethingToUpload = useMemo(
    () => files.length > 0 || urlList.length > 0 || faqText.trim().length > 0 || pastedText.trim().length > 0,
    [files, urlList, faqText, pastedText],
  );

  const addUrl = useCallback(() => {
    const u = urlDraft.trim();
    if (u.length === 0) { return; }
    setUrlList((prev) => (prev.includes(u) ? prev : [...prev, u]));
    setUrlDraft('');
  }, [urlDraft]);

  const upload = useCallback(async () => {
    if (!hasSomethingToUpload) { return; }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      if (urlList.length > 0) { fd.append('urls', JSON.stringify(urlList)); }
      if (faqText.trim().length > 0) { fd.append('faqs', faqText.trim()); }
      if (pastedText.trim().length > 0) {
        fd.append('pastedText', pastedText.trim());
        if (pastedTitle.trim().length > 0) { fd.append('pastedTitle', pastedTitle.trim()); }
      }
      fd.append('assetType', assetType);

      const res = await authFetch(`/api/agent/knowledge/${encodeURIComponent(agentId)}`, { method: 'POST', body: fd });
      const json = (await res.json()) as { success?: boolean; added?: { documents: number; urls: number; faqs: number }; error?: string };
      if (!res.ok || !json.success || !json.added) {
        setMessage({ type: 'error', text: json.error ?? 'Upload failed.' });
        return;
      }
      const a = json.added;
      setMessage({ type: 'success', text: `Added ${a.documents} document(s), ${a.urls} link(s), ${a.faqs} FAQ(s) to ${agentName}'s knowledge.` });
      // Reset form
      setFiles([]);
      setUrlList([]);
      setUrlDraft('');
      setFaqText('');
      setPastedTitle('');
      setPastedText('');
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }, [hasSomethingToUpload, files, urlList, faqText, pastedText, pastedTitle, assetType, authFetch, agentId, agentName, load]);

  const removeItem = useCallback(async (itemType: 'document' | 'url' | 'faq', itemId: string) => {
    setMessage(null);
    try {
      const res = await authFetch(`/api/agent/knowledge/${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setMessage({ type: 'error', text: json.error ?? 'Delete failed.' });
        return;
      }
      setArmedDelete(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed.' });
    }
  }, [authFetch, agentId, load]);

  // Two-step delete button
  const DeleteButton = ({ itemKey, onConfirm }: { itemKey: string; onConfirm: () => void }) => {
    const armed = armedDelete === itemKey;
    return (
      <div className="flex items-center gap-2">
        {armed && (
          <Button variant="outline" size="sm" onClick={() => setArmedDelete(null)}>Cancel</Button>
        )}
        <Button
          variant={armed ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => {
            if (armed) { onConfirm(); }
            else {
              setArmedDelete(itemKey);
              setTimeout(() => setArmedDelete((cur) => (cur === itemKey ? null : cur)), 5000);
            }
          }}
        >
          {armed ? 'Click again to remove' : 'Remove'}
        </Button>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <button onClick={() => router.push('/workforce')} className="text-sm text-muted-foreground hover:text-foreground mb-2">← Back to Workforce</button>
        <PageTitle>{agentName} — Knowledge Base</PageTitle>
        <SectionDescription className="mt-1">
          This material is private to {agentName}. It is used only when {agentName} works, and no other agent can see it — so each agent stays sharp on its own job.
        </SectionDescription>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-red-500/10 border-red-500/30 text-red-600'}`}>
          {message.text}
        </div>
      )}

      {/* ── Add knowledge ── */}
      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-5">
        <SectionTitle>Add to this agent&apos;s knowledge</SectionTitle>

        <div>
          <Caption>What kind of material is this?</Caption>
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
            className="mt-1 bg-background border border-border-strong rounded-lg px-3 py-2 text-sm text-foreground"
          >
            {(Object.keys(ASSET_LABELS) as AssetType[]).map((k) => <option key={k} value={k}>{ASSET_LABELS[k]}</option>)}
          </select>
        </div>

        <div>
          <Caption>Upload files (PDF, Word, Excel/CSV, or text — e.g. examples of great work)</Caption>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-border-strong file:bg-background file:text-foreground file:text-sm"
          />
          {files.length > 0 && <Caption>{files.length} file(s) ready: {files.map((f) => f.name).join(', ')}</Caption>}
        </div>

        <div>
          <Caption>Add a web page (the agent reads and learns from it)</Caption>
          <div className="mt-1 flex gap-2">
            <Input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="https://…" />
            <Button variant="outline" onClick={addUrl} disabled={urlDraft.trim().length === 0}>Add link</Button>
          </div>
          {urlList.length > 0 && (
            <ul className="mt-2 space-y-1">
              {urlList.map((u) => (
                <li key={u} className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="truncate">{u}</span>
                  <button onClick={() => setUrlList((prev) => prev.filter((x) => x !== u))} className="text-xs hover:text-foreground">remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Caption>Paste text directly (notes, a brief, an example email — anything written)</Caption>
          <Input className="mt-1" value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} placeholder="Give it a short title (optional)" />
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={4}
            placeholder="Paste the text here…"
            className="mt-2 w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div>
          <Caption>Add FAQs (one per pair, using &quot;Q:&quot; and &quot;A:&quot; lines)</Caption>
          <textarea
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
            rows={3}
            placeholder={'Q: What is our refund window?\nA: 30 days, no questions asked.'}
            className="mt-1 w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="default" disabled={!hasSomethingToUpload || uploading} onClick={() => void upload()}>
            {uploading ? 'Saving…' : 'Save to knowledge base'}
          </Button>
          <Caption>Video training (transcribed to text) is coming next — files, links, pasted text and FAQs work now.</Caption>
        </div>
      </div>

      {/* ── Current knowledge ── */}
      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-5">
        <SectionTitle>What {agentName} knows right now</SectionTitle>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            <div>
              <Caption>Documents &amp; pasted text ({documents.length})</Caption>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">Nothing yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">{d.filename}</div>
                        <Caption>{ASSET_LABELS[d.assetType]} · {d.type} · {d.chars.toLocaleString()} characters</Caption>
                      </div>
                      <DeleteButton itemKey={`document:${d.id}`} onConfirm={() => void removeItem('document', d.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Caption>Web pages ({urls.length})</Caption>
              {urls.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">Nothing yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {urls.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                      <span className="text-sm text-foreground truncate">{u.title}</span>
                      <DeleteButton itemKey={`url:${u.id}`} onConfirm={() => void removeItem('url', u.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Caption>FAQs ({faqs.length})</Caption>
              {faqs.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">Nothing yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {faqs.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                      <span className="text-sm text-foreground truncate">{f.question}</span>
                      <DeleteButton itemKey={`faq:${f.id}`} onConfirm={() => void removeItem('faq', f.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
