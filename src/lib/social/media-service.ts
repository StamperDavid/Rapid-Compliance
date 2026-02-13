/**
 * Social Media Service
 * Handles media uploads to Firebase Storage, validates file type/size per platform,
 * and returns metadata for social media posts.
 *
 * Storage path: social-media/{orgId}/{postId}/original/
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { SocialMediaAsset, SocialPlatform } from '@/types/social';

// Platform-specific file constraints
interface PlatformConstraints {
  maxImageSizeBytes: number;
  maxVideoSizeBytes: number;
  allowedImageTypes: string[];
  allowedVideoTypes: string[];
}

const PLATFORM_CONSTRAINTS: Record<string, PlatformConstraints> = {
  twitter: {
    maxImageSizeBytes: 5 * 1024 * 1024,       // 5MB
    maxVideoSizeBytes: 512 * 1024 * 1024,      // 512MB
    allowedImageTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4'],
  },
  linkedin: {
    maxImageSizeBytes: 10 * 1024 * 1024,       // 10MB
    maxVideoSizeBytes: 200 * 1024 * 1024,      // 200MB
    allowedImageTypes: ['image/png', 'image/jpeg', 'image/gif'],
    allowedVideoTypes: ['video/mp4'],
  },
  instagram: {
    maxImageSizeBytes: 8 * 1024 * 1024,        // 8MB
    maxVideoSizeBytes: 100 * 1024 * 1024,      // 100MB
    allowedImageTypes: ['image/jpeg', 'image/png'],
    allowedVideoTypes: ['video/mp4'],
  },
  facebook: {
    maxImageSizeBytes: 10 * 1024 * 1024,       // 10MB
    maxVideoSizeBytes: 4 * 1024 * 1024 * 1024, // 4GB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
    allowedVideoTypes: ['video/mp4'],
  },
};

// General fallback max (50MB as per plan)
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export class SocialMediaService {
  /**
   * Validate a file against platform-specific constraints
   */
  static validateFile(
    mimeType: string,
    sizeBytes: number,
    platform?: SocialPlatform
  ): { valid: boolean; error?: string } {
    // Global max
    if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      return { valid: false, error: `File exceeds maximum upload size of 50MB` };
    }

    if (!platform) {
      // General validation only
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      if (!isImage && !isVideo) {
        return { valid: false, error: `Unsupported file type: ${mimeType}` };
      }
      return { valid: true };
    }

    const constraints = PLATFORM_CONSTRAINTS[platform];
    if (!constraints) {
      return { valid: true }; // Unknown platform, allow
    }

    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');

    if (isImage) {
      if (!constraints.allowedImageTypes.includes(mimeType)) {
        return { valid: false, error: `${platform} does not support ${mimeType} images` };
      }
      if (sizeBytes > constraints.maxImageSizeBytes) {
        const maxMB = Math.round(constraints.maxImageSizeBytes / (1024 * 1024));
        return { valid: false, error: `Image exceeds ${platform}'s ${maxMB}MB limit` };
      }
    } else if (isVideo) {
      if (!constraints.allowedVideoTypes.includes(mimeType)) {
        return { valid: false, error: `${platform} does not support ${mimeType} video` };
      }
      if (sizeBytes > constraints.maxVideoSizeBytes) {
        const maxMB = Math.round(constraints.maxVideoSizeBytes / (1024 * 1024));
        return { valid: false, error: `Video exceeds ${platform}'s ${maxMB}MB limit` };
      }
    } else {
      return { valid: false, error: `Unsupported file type: ${mimeType}` };
    }

    return { valid: true };
  }

  /**
   * Upload a media file to Firebase Storage
   */
  static async upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    options: {
      platform?: SocialPlatform;
      postId?: string;
    } = {}
  ): Promise<SocialMediaAsset> {
    // Validate
    const validation = this.validateFile(mimeType, fileBuffer.length, options.platform);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const assetId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const storagePath = `social-media/${PLATFORM_ID}/${options.postId ?? 'unattached'}/original/${assetId}-${fileName}`;

    try {
      // Dynamic import to avoid issues in non-server contexts
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { app } = await import('@/lib/firebase/config');

      const storage = getStorage(app ?? undefined);
      const storageRef = ref(storage, storagePath);

      // Upload file
      const snapshot = await uploadBytes(storageRef, fileBuffer, {
        contentType: mimeType,
        customMetadata: {
          assetId,
          platform: options.platform ?? 'general',
          postId: options.postId ?? '',
        },
      });

      // Get download URL
      const url = await getDownloadURL(snapshot.ref);

      const asset: SocialMediaAsset = {
        id: assetId,
        url,
        fileName,
        mimeType,
        sizeBytes: fileBuffer.length,
        platform: options.platform,
        uploadedAt: new Date().toISOString(),
        postId: options.postId,
      };

      logger.info('SocialMediaService: File uploaded', {
        assetId,
        fileName,
        sizeBytes: fileBuffer.length,
        platform: options.platform,
      });

      return asset;
    } catch (error) {
      logger.error('SocialMediaService: Upload failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a media file from Firebase Storage
   */
  static async deleteFile(storagePath: string): Promise<void> {
    try {
      const { getStorage, ref, deleteObject } = await import('firebase/storage');
      const { app } = await import('@/lib/firebase/config');

      const storage = getStorage(app ?? undefined);
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);

      logger.info('SocialMediaService: File deleted', { storagePath });
    } catch (error) {
      logger.error('SocialMediaService: Delete failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
