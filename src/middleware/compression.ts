/**
 * API Response Compression Middleware
 * Compress API responses to reduce bandwidth
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Check if response should be compressed
 */
function shouldCompress(request: NextRequest, response: Response): boolean {
  // Don't compress if already compressed
  if (response.headers.get('Content-Encoding')) {
    return false;
  }
  
  // Don't compress images, videos, or already compressed formats
  const contentType = response.headers.get('Content-Type') || '';
  if (
    contentType.includes('image/') ||
    contentType.includes('video/') ||
    contentType.includes('audio/') ||
    contentType.includes('application/zip') ||
    contentType.includes('application/gzip')
  ) {
    return false;
  }
  
  // Check if client accepts compression
  const acceptEncoding = request.headers.get('Accept-Encoding') || '';
  if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('br')) {
    return false;
  }
  
  return true;
}

/**
 * Get compression format
 */
function getCompressionFormat(request: NextRequest): 'br' | 'gzip' | null {
  const acceptEncoding = request.headers.get('Accept-Encoding') || '';
  
  // Prefer Brotli (better compression)
  if (acceptEncoding.includes('br')) {
    return 'br';
  }
  
  // Fallback to gzip
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }
  
  return null;
}

export { shouldCompress, getCompressionFormat };











