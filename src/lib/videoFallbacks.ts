/**
 * Video Format Fallback Utilities
 * Provides automatic fallback mechanisms for video playback compatibility
 */

import { browserCompatibility } from './browserCompatibility';

export interface VideoFallbackOptions {
  enableMultipleFormats?: boolean;
  enableCodecDetection?: boolean;
  enableServerCheck?: boolean;
  maxFallbackAttempts?: number;
  fallbackTimeout?: number;
}

export interface VideoFallbackResult {
  success: boolean;
  src: string;
  format: string;
  reason?: string;
  attempts: number;
}

export class VideoFallbackManager {
  private static instance: VideoFallbackManager;
  private options: VideoFallbackOptions;

  private constructor(options: VideoFallbackOptions = {}) {
    this.options = {
      enableMultipleFormats: true,
      enableCodecDetection: true,
      enableServerCheck: true,
      maxFallbackAttempts: 3,
      fallbackTimeout: 5000,
      ...options
    };
  }

  static getInstance(options?: VideoFallbackOptions): VideoFallbackManager {
    if (!VideoFallbackManager.instance) {
      VideoFallbackManager.instance = new VideoFallbackManager(options);
    }
    return VideoFallbackManager.instance;
  }

  /**
   * Attempt to load video with automatic fallback
   */
  async loadWithFallback(
    videoElement: HTMLVideoElement,
    originalSrc: string,
    onProgress?: (attempt: number, format: string) => void,
    onError?: (error: Error, attempt: number) => void
  ): Promise<VideoFallbackResult> {
    const capabilities = browserCompatibility.getCapabilities();
    const fallbackFormats = this.getFallbackFormats(originalSrc, capabilities);
    let attempts = 0;

    // Try original source first
    attempts++;
    onProgress?.(attempts, this.getFormatFromSrc(originalSrc));

    try {
      const result = await this.tryLoadVideo(videoElement, originalSrc);
      if (result.success) {
        return {
          success: true,
          src: originalSrc,
          format: this.getFormatFromSrc(originalSrc),
          attempts
        };
      }
    } catch (error) {
      onError?.(error as Error, attempts);
    }

    // Try fallback formats
    if (this.options.enableMultipleFormats) {
      for (const fallbackSrc of fallbackFormats) {
        if (attempts >= this.options.maxFallbackAttempts) break;

        attempts++;
        const format = this.getFormatFromSrc(fallbackSrc);
        onProgress?.(attempts, format);

        try {
          const result = await this.tryLoadVideo(videoElement, fallbackSrc);
          if (result.success) {
            return {
              success: true,
              src: fallbackSrc,
              format,
              attempts,
              reason: `Fallback to ${format} due to ${result.reason || 'compatibility issue'}`
            };
          }
        } catch (error) {
          onError?.(error as Error, attempts);
        }
      }
    }

    return {
      success: false,
      src: originalSrc,
      format: this.getFormatFromSrc(originalSrc),
      attempts,
      reason: 'All fallback attempts failed'
    };
  }

  /**
   * Try to load a video source
   */
  private async tryLoadVideo(videoElement: HTMLVideoElement, src: string): Promise<{ success: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        videoElement.removeEventListener('loadeddata', onSuccess);
        videoElement.removeEventListener('error', onError);
        videoElement.removeEventListener('canplay', onCanPlay);
        resolve({ success: false, reason: 'Timeout' });
      }, this.options.fallbackTimeout);

      const cleanup = () => {
        clearTimeout(timeout);
        videoElement.removeEventListener('loadeddata', onSuccess);
        videoElement.removeEventListener('error', onError);
        videoElement.removeEventListener('canplay', onCanPlay);
      };

      const onSuccess = () => {
        cleanup();
        resolve({ success: true });
      };

      const onCanPlay = () => {
        cleanup();
        resolve({ success: true });
      };

      const onError = (event: Event) => {
        cleanup();
        const videoError = (event.target as HTMLVideoElement).error;
        const reason = videoError ? `Error ${videoError.code}: ${videoError.message}` : 'Unknown error';
        resolve({ success: false, reason });
      };

      videoElement.addEventListener('loadeddata', onSuccess);
      videoElement.addEventListener('canplay', onCanPlay);
      videoElement.addEventListener('error', onError);

      videoElement.src = src;
    });
  }

  /**
   * Get fallback formats for a video source
   */
  private getFallbackFormats(src: string, capabilities: any): string[] {
    const fallbacks: string[] = [];

    // If HLS, try MP4 fallback
    if (src.includes('.m3u8')) {
      const mp4Fallback = src.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
        const baseName = match.split('/')[3];
        return `/videos/${decodeURIComponent(baseName)}.mp4`;
      });

      if (mp4Fallback !== src) {
        fallbacks.push(mp4Fallback);
      }

      // Try WebM fallback if VP8/VP9 is supported
      if (capabilities.codecSupport.vp8 || capabilities.codecSupport.vp9) {
        const webmFallback = mp4Fallback.replace('.mp4', '.webm');
        fallbacks.push(webmFallback);
      }

      // Try MOV fallback for Safari
      if (capabilities.isSafari) {
        const movFallback = mp4Fallback.replace('.mp4', '.mov');
        fallbacks.push(movFallback);
      }
    }

    // If MP4 and codec issues detected, try alternative formats
    if (src.includes('.mp4') && !capabilities.codecSupport.h264High) {
      // Try WebM if VP8/VP9 supported
      if (capabilities.codecSupport.vp8 || capabilities.codecSupport.vp9) {
        const webmFallback = src.replace('.mp4', '.webm');
        fallbacks.push(webmFallback);
      }

      // Try AV1 if supported
      if (capabilities.codecSupport.av1) {
        const av1Fallback = src.replace('.mp4', '.mkv');
        fallbacks.push(av1Fallback);
      }

      // Try HEVC if supported
      if (capabilities.codecSupport.hevc) {
        const hevcFallback = src.replace('.mp4', '_hevc.mp4');
        fallbacks.push(hevcFallback);
      }
    }

    return fallbacks;
  }

  /**
   * Get format from source URL
   */
  private getFormatFromSrc(src: string): string {
    if (src.includes('.m3u8')) return 'HLS';
    if (src.includes('.mp4')) return 'MP4';
    if (src.includes('.webm')) return 'WebM';
    if (src.includes('.mov')) return 'QuickTime';
    if (src.includes('.mkv')) return 'MKV';
    if (src.includes('.avi')) return 'AVI';
    return 'Unknown';
  }

  /**
   * Check if video file exists on server
   */
  async checkVideoExists(src: string): Promise<boolean> {
    if (!this.options.enableServerCheck) return true;

    try {
      const response = await fetch(src, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get optimal format based on browser capabilities
   */
  getOptimalFormat(capabilities: any): string {
    // Prefer HLS if supported (best for streaming)
    if (capabilities.supportsHLS) {
      return 'HLS';
    }

    // Otherwise choose based on codec support
    if (capabilities.codecSupport.h264High || capabilities.codecSupport.h264Main) {
      return 'MP4';
    }

    if (capabilities.codecSupport.vp9) {
      return 'WebM';
    }

    if (capabilities.codecSupport.hevc) {
      return 'HEVC';
    }

    if (capabilities.codecSupport.av1) {
      return 'AV1';
    }

    // Fallback to MP4 even if only baseline supported
    return 'MP4';
  }

  /**
   * Preload next video in background
   */
  async preloadNextVideo(src: string): Promise<void> {
    try {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = src;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      // Remove after preload
      setTimeout(() => {
        document.head.removeChild(link);
      }, 30000);
    } catch (error) {
      console.warn('[VideoFallbackManager] Preload failed:', error);
    }
  }
}

// Export singleton instance
export const videoFallbackManager = VideoFallbackManager.getInstance();
