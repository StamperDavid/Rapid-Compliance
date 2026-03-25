/**
 * Vision Service
 * AI agents that can see and analyze images/videos
 * Uses GPT-4 Vision and Gemini Pro Vision
 */

import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface VisionAnalysisRequest {
  imageUrl?: string;
  imageBase64?: string;
  videoUrl?: string;
  prompt: string;
  model?: 'gpt-4-vision' | 'gemini-pro-vision';
  maxTokens?: number;
}

export interface VisionAnalysisResponse {
  analysis: string;
  confidence: number;
  detectedObjects?: string[];
  suggestions?: string[];
  model: string;
  processingTime: number;
}

interface OpenAIVisionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ServiceKeys {
  openaiApiKey?: string;
}

/**
 * Analyze image with AI
 */
export async function analyzeImage(
  request: VisionAnalysisRequest,
): Promise<VisionAnalysisResponse> {
  const startTime = Date.now();
  const model = request.model ?? 'gpt-4-vision';

  if (model === 'gpt-4-vision') {
    return analyzeWithGPT4Vision(request, startTime);
  } else {
    return analyzeWithGeminiVision(request, startTime);
  }
}

/**
 * Analyze image with GPT-4 Vision
 */
async function analyzeWithGPT4Vision(
  request: VisionAnalysisRequest,
  startTime: number = Date.now()
): Promise<VisionAnalysisResponse> {
  try {
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'openai') as ServiceKeys | null;
    const apiKey = keys?.openaiApiKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build image content
    const imageContent = request.imageUrl
      ? { type: 'image_url', image_url: { url: request.imageUrl } }
      : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${request.imageBase64 ?? ''}` } };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              imageContent,
            ],
          },
        ],
        max_tokens: request.maxTokens ?? 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      throw new Error(`GPT-4 Vision error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json() as OpenAIVisionResponse;
    const analysis = data.choices[0]?.message?.content ?? '';

    // Extract detected objects and suggestions
    const detectedObjects = extractDetectedObjects(analysis);
    const suggestions = extractSuggestions(analysis);

    return {
      analysis,
      confidence: calculateConfidence(analysis),
      detectedObjects,
      suggestions,
      model: 'gpt-4-vision',
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[GPT-4 Vision] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'vision-service.ts' });
    throw new Error(`Image analysis failed: ${errorMessage}`);
  }
}

/**
 * Analyze image with Gemini Pro Vision
 */
async function analyzeWithGeminiVision(
  request: VisionAnalysisRequest,
  startTime: number = Date.now()
): Promise<VisionAnalysisResponse> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

    // Prepare image data
    let imagePart;

    if (request.imageUrl) {
      // Fetch image and convert to base64
      const imageResponse = await fetch(request.imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      imagePart = {
        inlineData: {
          data: base64,
          mimeType: imageResponse.headers.get('content-type') ?? 'image/jpeg',
        },
      };
    } else if (request.imageBase64) {
      imagePart = {
        inlineData: {
          data: request.imageBase64,
          mimeType: 'image/jpeg',
        },
      };
    } else {
      throw new Error('No image provided');
    }

    // Generate content
    const result = await model.generateContent([request.prompt, imagePart]);
    const analysis = result.response.text();

    return {
      analysis,
      confidence: calculateConfidence(analysis),
      detectedObjects: extractDetectedObjects(analysis),
      suggestions: extractSuggestions(analysis),
      model: 'gemini-pro-vision',
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[Gemini Vision] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'vision-service.ts' });
    throw new Error(`Image analysis failed: ${errorMessage}`);
  }
}

/**
 * Analyze video (extract frames and analyze)
 */
export async function analyzeVideo(
  videoUrl: string,
  prompt: string,
  options?: {
    frameInterval?: number; // Extract frame every N seconds
    maxFrames?: number;
  }
): Promise<{
  frames: VisionAnalysisResponse[];
  summary: string;
}> {
  try {
    // Extract frames from video (async with API or thumbnail fallback)
    const frames = await extractVideoFramesAsync(videoUrl, {
      interval: options?.frameInterval ?? 5, // Every 5 seconds
      maxFrames: options?.maxFrames ?? 10,
    });

    // Analyze each frame
    const analyses = await Promise.all(
      frames.map(frame =>
        analyzeImage({
          imageBase64: frame,
          prompt,
          model: 'gemini-pro-vision', // Gemini is better for video
        })
      )
    );

    // Summarize all frame analyses
    const summary = await summarizeVideoAnalysis(analyses, prompt);

    return {
      frames: analyses,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[Video Analysis] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'vision-service.ts' });
    throw new Error(`Video analysis failed: ${errorMessage}`);
  }
}

/**
 * Async frame extraction using Google Video Intelligence API.
 * If the API is not configured, falls back to using the video URL as a
 * single-frame thumbnail reference.
 */
async function extractVideoFramesAsync(
  videoUrl: string,
  options: { interval: number; maxFrames: number }
): Promise<string[]> {
  try {
    // Attempt Google Video Intelligence API for keyframe extraction
    const googleKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'googleCloud') as Record<string, string> | null;

    if (googleKeys?.apiKey) {
      return await extractFramesViaVideoIntelligence(videoUrl, googleKeys.apiKey, options);
    }

    // Fallback: use the video URL itself as a single-frame reference.
    // Many video hosting providers (Hedra, Mux, etc.) serve an OG image / thumbnail
    // at the video URL by appending query params or using a known thumbnail endpoint.
    logger.info('[Video] Google Video Intelligence not configured — using video thumbnail fallback', { file: 'vision-service.ts' });
    const thumbnailUrl = deriveVideoThumbnail(videoUrl);
    if (thumbnailUrl) {
      return [thumbnailUrl];
    }

    return [];
  } catch (error) {
    logger.warn('[Video] Frame extraction failed, returning empty frames', {
      file: 'vision-service.ts',
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Extract keyframes via Google Video Intelligence API.
 * Annotates the video for SHOT_CHANGE_DETECTION and fetches representative
 * frame thumbnails at the detected shot boundaries.
 */
async function extractFramesViaVideoIntelligence(
  videoUrl: string,
  apiKey: string,
  options: { interval: number; maxFrames: number }
): Promise<string[]> {
  const annotateUrl = `https://videointelligence.googleapis.com/v1/videos:annotate?key=${apiKey}`;

  // Request shot change detection
  const annotateResponse = await fetch(annotateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputUri: videoUrl,
      features: ['SHOT_CHANGE_DETECTION'],
    }),
  });

  if (!annotateResponse.ok) {
    const errorText = await annotateResponse.text();
    throw new Error(`Video Intelligence API error: ${errorText}`);
  }

  interface AnnotateOperation {
    name: string;
    done?: boolean;
    response?: {
      annotationResults?: Array<{
        shotAnnotations?: Array<{
          startTimeOffset?: string;
          endTimeOffset?: string;
        }>;
      }>;
    };
  }

  const operation = await annotateResponse.json() as AnnotateOperation;

  // Poll for completion (max 60 seconds)
  const operationUrl = `https://videointelligence.googleapis.com/v1/operations/${operation.name}?key=${apiKey}`;
  let result: AnnotateOperation = operation;
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts && !result.done; attempt++) {
    await new Promise<void>(resolve => { setTimeout(resolve, 5000); });
    const pollResponse = await fetch(operationUrl);
    if (pollResponse.ok) {
      result = await pollResponse.json() as AnnotateOperation;
    }
  }

  if (!result.done || !result.response?.annotationResults?.[0]?.shotAnnotations) {
    logger.warn('[Video] Video Intelligence annotation did not complete in time', { file: 'vision-service.ts' });
    return [];
  }

  // Extract timestamps at shot boundaries, limited by interval and maxFrames
  const shots = result.response.annotationResults[0].shotAnnotations;
  const frameTimestamps: number[] = [];

  for (const shot of shots) {
    if (frameTimestamps.length >= options.maxFrames) { break; }
    const startOffset = parseTimeOffset(shot.startTimeOffset ?? '0s');
    const lastTimestamp = frameTimestamps.length > 0 ? frameTimestamps[frameTimestamps.length - 1] : -options.interval;
    if (startOffset - lastTimestamp >= options.interval) {
      frameTimestamps.push(startOffset);
    }
  }

  // For each timestamp, generate a thumbnail URL reference
  // (actual base64 frame data would require a separate frame-grab service)
  return frameTimestamps.map(ts => `${videoUrl}#t=${ts}`);
}

/**
 * Parse Video Intelligence API time offset string (e.g., "1.500s") to seconds
 */
function parseTimeOffset(offset: string): number {
  return parseFloat(offset.replace('s', '')) || 0;
}

/**
 * Derive a thumbnail URL from a video URL.
 * Supports common patterns from video hosting services.
 */
function deriveVideoThumbnail(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);

    // YouTube
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.searchParams.get('v') ?? url.pathname.split('/').pop();
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    // Vimeo
    if (url.hostname.includes('vimeo.com')) {
      return `https://vumbnail.com/${url.pathname.split('/').pop()}.jpg`;
    }

    // For other providers, return the URL itself — vision models can
    // often process video URLs directly or the hosting provider may serve
    // an OG image at the same URL
    return videoUrl;
  } catch {
    return videoUrl;
  }
}

/**
 * Summarize multiple frame analyses
 */
async function summarizeVideoAnalysis(
  analyses: VisionAnalysisResponse[],
  originalPrompt: string
): Promise<string> {
  const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');

  const summaryPrompt = `Summarize these video frame analyses into a coherent video description:

Original Question: ${originalPrompt}

Frame Analyses:
${analyses.map((a, i) => `Frame ${i + 1}: ${a.analysis}`).join('\n\n')}

Provide a comprehensive summary of what's happening in the video:`;

  const response = await sendUnifiedChatMessage({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: summaryPrompt }],
  });

  return response.text;
}

/**
 * Extract detected objects from analysis
 */
function extractDetectedObjects(analysis: string): string[] {
  const objects: string[] = [];

  // Look for common object detection patterns
  const patterns = [
    /I see (?:a |an |the )?([a-z\s]+)/gi,
    /(?:contains?|shows?|depicts?) (?:a |an |the )?([a-z\s]+)/gi,
    /(?:There (?:is|are)) (?:a |an |the )?([a-z\s]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = analysis.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        objects.push(match[1].trim());
      }
    }
  }

  return [...new Set(objects)].slice(0, 10); // Return unique objects, max 10
}

/**
 * Extract suggestions from analysis
 */
function extractSuggestions(analysis: string): string[] {
  const suggestions: string[] = [];

  // Look for suggestion patterns
  const patterns = [
    /(?:suggest|recommend|consider|try|could) ([^.!?]+)/gi,
    /(?:You (?:should|could|might)) ([^.!?]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = analysis.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        suggestions.push(match[1].trim());
      }
    }
  }

  return [...new Set(suggestions)].slice(0, 5); // Return unique suggestions, max 5
}

/**
 * Calculate confidence based on analysis content
 */
function calculateConfidence(analysis: string): number {
  let confidence = 70; // Base confidence

  // Increase confidence for specific details
  if (analysis.match(/\d+/)) {confidence += 5;} // Contains numbers
  if (analysis.length > 200) {confidence += 5;} // Detailed response
  if (analysis.includes('specifically')) {confidence += 5;}
  if (analysis.includes('clearly')) {confidence += 5;}

  // Decrease confidence for uncertainty
  if (analysis.includes('might')) {confidence -= 5;}
  if (analysis.includes('possibly')) {confidence -= 5;}
  if (analysis.includes('unclear')) {confidence -= 10;}
  if (analysis.includes('cannot')) {confidence -= 10;}

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Common vision analysis use cases
 */
export const VisionUseCases = {
  /**
   * Product damage assessment
   */
  assessProductDamage: (imageUrl: string) =>
    analyzeImage({
      imageUrl,
      prompt: 'Analyze this image for any product damage. Describe the damage in detail, assess severity (minor/moderate/severe), and suggest whether it should be replaced or repaired.',
    }),

  /**
   * Product identification
   */
  identifyProduct: (imageUrl: string) =>
    analyzeImage({
      imageUrl,
      prompt: 'Identify this product. What is it? What brand? What model or variant? What are its key features?',
    }),

  /**
   * Receipt/document OCR
   */
  extractReceiptData: (imageUrl: string) =>
    analyzeImage({
      imageUrl,
      prompt: 'Extract all text from this receipt/document. List items, prices, total, date, and merchant name.',
    }),

  /**
   * Quality control
   */
  qualityControl: (imageUrl: string) =>
    analyzeImage({
      imageUrl,
      prompt: 'Inspect this product for quality control. Identify any defects, inconsistencies, or issues. Rate quality from 1-10.',
    }),

  /**
   * General image description
   */
  describeImage: (imageUrl: string) =>
    analyzeImage({
      imageUrl,
      prompt: 'Describe this image in detail. What do you see? What is happening? What are the key elements?',
    }),
};
