/**
 * Vision Service
 * AI agents that can see and analyze images/videos
 * Uses GPT-4 Vision and Gemini Pro Vision
 */

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

/**
 * Analyze image with AI
 */
export async function analyzeImage(
  request: VisionAnalysisRequest,
  organizationId?: string
): Promise<VisionAnalysisResponse> {
  const startTime = Date.now();
  const model = request.model || 'gpt-4-vision';
  
  if (model === 'gpt-4-vision') {
    return analyzeWithGPT4Vision(request, organizationId, startTime);
  } else {
    return analyzeWithGeminiVision(request, organizationId, startTime);
  }
}

/**
 * Analyze image with GPT-4 Vision
 */
async function analyzeWithGPT4Vision(
  request: VisionAnalysisRequest,
  organizationId?: string,
  startTime: number = Date.now()
): Promise<VisionAnalysisResponse> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const keys = await apiKeyService.getServiceKey(organizationId || 'demo', 'openai');
    const apiKey = (keys as any)?.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Build image content
    const imageContent = request.imageUrl
      ? { type: 'image_url', image_url: { url: request.imageUrl } }
      : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${request.imageBase64}` } };
    
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
        max_tokens: request.maxTokens || 500,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GPT-4 Vision error: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
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
  } catch (error: any) {
    console.error('[GPT-4 Vision] Error:', error);
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}

/**
 * Analyze image with Gemini Pro Vision
 */
async function analyzeWithGeminiVision(
  request: VisionAnalysisRequest,
  organizationId?: string,
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
          mimeType: imageResponse.headers.get('content-type') || 'image/jpeg',
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
  } catch (error: any) {
    console.error('[Gemini Vision] Error:', error);
    throw new Error(`Image analysis failed: ${error.message}`);
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
    // Extract frames from video
    const frames = await extractVideoFrames(videoUrl, {
      interval: options?.frameInterval || 5, // Every 5 seconds
      maxFrames: options?.maxFrames || 10,
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
  } catch (error: any) {
    console.error('[Video Analysis] Error:', error);
    throw new Error(`Video analysis failed: ${error.message}`);
  }
}

/**
 * Extract frames from video
 */
async function extractVideoFrames(
  videoUrl: string,
  options: { interval: number; maxFrames: number }
): Promise<string[]> {
  // In production, use ffmpeg or cloud service
  // For now, return mock frames
  console.warn('[Video] Frame extraction not yet implemented, using mock data');
  return [];
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
  if (analysis.match(/\d+/)) confidence += 5; // Contains numbers
  if (analysis.length > 200) confidence += 5; // Detailed response
  if (analysis.includes('specifically')) confidence += 5;
  if (analysis.includes('clearly')) confidence += 5;
  
  // Decrease confidence for uncertainty
  if (analysis.includes('might')) confidence -= 5;
  if (analysis.includes('possibly')) confidence -= 5;
  if (analysis.includes('unclear')) confidence -= 10;
  if (analysis.includes('cannot')) confidence -= 10;
  
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

