import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVideo } from './VideoContext';
import { useConvexAuth } from 'convex/react';
import VideoPlayer from './VideoPlayer';
import { VideoManager } from './VideoManager';
import { videoCache } from './VideoCache';
import { performanceMonitor, QualityRecommendation } from './VideoPerformanceMonitor';
import ModernVideoControls from './ModernVideoControls';
import { videoFallbackManager } from '../lib/videoFallbacks';
import { browserCompatibility } from '../lib/browserCompatibility';

export default function ModernBackgroundVideo() {
  const {
    playlist,
    currentIndex,
    setIndex,
    next,
    isPlaying,
    play,
    pause,
    muted,
    volume,
    currentTime,
    setCurrentTime,
    registerDomControls,
  } = useVideo();

  const { isAuthenticated } = useConvexAuth();

  const videoManagerRef = useRef<VideoManager | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const src = playlist[currentIndex]?.url ?? '';
  const filename = playlist[currentIndex]?.name ?? '';

  // Initialize video manager and performance monitoring
  useEffect(() => {
    if (!videoElementRef.current) return;

    const videoManager = new VideoManager(videoElementRef.current);
    videoManagerRef.current = videoManager;

    // Attach performance monitor
    performanceMonitor.attach(videoElementRef.current);

    // Listen for quality recommendations
    const unsubscribe = performanceMonitor.onRecommendation(handleQualityRecommendation);

    return () => {
      videoManager.destroy();
      performanceMonitor.detach();
      unsubscribe();
    };
  }, []);

  // Handle quality recommendations from performance monitor
  const handleQualityRecommendation = useCallback((metrics: any, recommendation: QualityRecommendation) => {
    if (recommendation.action !== 'none') {
      console.log('Quality recommendation:', recommendation.reason);

      if (recommendation.action === 'decrease') {
        // Force lower quality
        performanceMonitor.forceQualityLevel(Math.max(0, performanceMonitor.getAvailableLevels().length - 2));
      } else if (recommendation.action === 'increase') {
        // Allow higher quality
        performanceMonitor.forceQualityLevel(-1); // Auto quality
      }
    }
  }, []);

  // Load and play video when source changes
  useEffect(() => {
    if (!videoManagerRef.current || !src) return;

    const loadVideo = async () => {
      try {
        setError(null);
        setIsReady(false);
        setIsBuffering(true);

        // Check cache first
        const isCached = await videoCache.isCached(src);
        if (!isCached) {
          // Preload the next video
          const nextIndex = (currentIndex + 1) % playlist.length;
          const nextUrl = playlist[nextIndex]?.url;
          if (nextUrl) {
            videoCache.preload(nextUrl, 'low');
          }
        }

        // Check browser compatibility and special handling needs
        const capabilities = browserCompatibility.getCapabilities();
        const specialHandling = browserCompatibility.needsSpecialHandling();

        // Handle special cases for iOS/Android autoplay restrictions
        const shouldAutoplay = !specialHandling || specialHandling.action !== 'delay_autoplay';

        // Load video with enhanced fallback support
        if (videoElementRef.current) {
          const fallbackResult = await videoFallbackManager.loadWithFallback(
            videoElementRef.current,
            src,
            (attempt, format) => {
              console.log(`[ModernBackgroundVideo] Attempting format: ${format} (attempt ${attempt})`);
            },
            (error, attempt) => {
              console.warn(`[ModernBackgroundVideo] Fallback attempt ${attempt} failed:`, error.message);
            }
          );

          if (fallbackResult.success && fallbackResult.src !== src) {
            console.log(`[ModernBackgroundVideo] Successfully loaded fallback format: ${fallbackResult.format}`);
          }

          // Apply video settings
          const videoElement = videoElementRef.current;
          videoElement.muted = !isAuthenticated || muted;
          videoElement.volume = volume;
          videoElement.autoplay = shouldAutoplay;
          videoElement.loop = false;
          videoElement.preload = isAuthenticated ? 'auto' : 'metadata';
        }

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load video');
        setError(error);
        console.error('Video load error:', error);
      }
    };

    loadVideo();
  }, [src, currentIndex, playlist, isAuthenticated, muted, volume]);

  // Handle video ready state
  const handleVideoReady = useCallback(() => {
    setIsReady(true);
    setIsBuffering(false);
    setIsVisible(true);
  }, []);

  // Handle video errors with automatic fallback and retry logic
  const handleVideoError = useCallback((error: Error) => {
    console.error(`[ModernBackgroundVideo] Video error for ${filename}:`, error);
    setError(error);
    setIsBuffering(false);

    // Categorize the error type for better handling
    const isNetworkError = error.message.includes('Network error') ||
                          error.message.includes('connection') ||
                          error.message.includes('ERR_CONNECTION_REFUSED') ||
                          error.message.includes('404') ||
                          error.message.includes('403');

    const isFormatError = error.message.includes('format not supported') ||
                         error.message.includes('decoding error') ||
                         error.message.includes('codec') ||
                         error.message.includes('Video format not supported') ||
                         error.message.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') ||
                         error.message.includes('MEDIA_ERR_DECODE');

    const isBufferError = error.message.includes('buffer') ||
                         error.message.includes('stalled') ||
                         error.message.includes('waiting');

    if (isFormatError) {
      // Log codec error for monitoring
      console.warn('[ModernBackgroundVideo] Codec/format error detected - attempting recovery strategies');
      console.warn('[ModernBackgroundVideo] This may be a browser compatibility issue with H.264 High Profile');

      // Clear error state and force video reload with delay
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Clearing error state and attempting video reload');
        setError(null);
        setIsBuffering(true);
      }, 500);

      // For format errors, advance to next video after a short delay
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Advancing to next video due to codec incompatibility');
        try {
          next();
        } catch (nextError) {
          console.error('Failed to advance to next video:', nextError);
        }
      }, 1500); // Give reload attempt time to work

    } else if (isNetworkError) {
      // Network errors - more aggressive retry
      console.warn('[ModernBackgroundVideo] Network error detected - this may indicate server issues');

      // Clear error and try to reload current video first
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Retrying current video due to network error');
        setError(null);
        setIsBuffering(true);
        // Force re-initialization by triggering the load effect
        setIsReady(false);
      }, 1000);

      // If retry doesn't work, advance after longer delay
      setTimeout(() => {
        if (error) { // Only advance if error still exists
          console.log('[ModernBackgroundVideo] Network error persists, advancing to next video');
          try {
            next();
          } catch (nextError) {
            console.error('Failed to advance to next video:', nextError);
          }
        }
      }, 5000); // Longer delay for network issues

    } else if (isBufferError) {
      // Buffer/stalled errors - less aggressive
      console.warn('[ModernBackgroundVideo] Buffer/stalled error detected - attempting recovery');

      // Clear error and wait for natural recovery
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Clearing buffer error, allowing natural recovery');
        setError(null);
        setIsBuffering(false); // Let it try to recover naturally
      }, 2000);

      // Only advance if the issue persists
      setTimeout(() => {
        if (error) {
          console.log('[ModernBackgroundVideo] Buffer issue persists, advancing to next video');
          try {
            next();
          } catch (nextError) {
            console.error('Failed to advance to next video:', nextError);
          }
        }
      }, 8000); // Even longer delay for buffer issues

    } else {
      // Unknown/other errors
      console.warn('[ModernBackgroundVideo] Unknown error type detected:', error.message);

      // Clear error and advance after moderate delay
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Clearing unknown error and advancing to next video');
        setError(null);
        try {
          next();
        } catch (nextError) {
          console.error('Failed to advance to next video:', nextError);
        }
      }, 3000);
    }
  }, [next, filename]);

  // Handle buffering state changes
  const handleBufferingChange = useCallback((isBuffering: boolean) => {
    setIsBuffering(isBuffering);
  }, []);

  // Register controls for external management
  useEffect(() => {
    if (!videoManagerRef.current) return;

    const controls = {
      play: () => videoManagerRef.current?.getVideoElement()?.play(),
      pause: () => videoManagerRef.current?.getVideoElement()?.pause(),
      seek: (time: number) => {
        const video = videoManagerRef.current?.getVideoElement();
        if (video) video.currentTime = time;
      },
      applyState: (opts: { muted?: boolean; volume?: number }) => {
        const video = videoManagerRef.current?.getVideoElement();
        if (!video) return;

        if (opts.muted !== undefined) video.muted = opts.muted;
        if (opts.volume !== undefined) video.volume = opts.volume;
      },
    };

    registerDomControls(controls);

    return () => registerDomControls(null);
  }, [registerDomControls]);

  // Handle video end - advance to next track
  useEffect(() => {
    const video = videoManagerRef.current?.getVideoElement();
    if (!video) return;

    const handleEnded = () => {
      try {
        next();
      } catch (error) {
        console.error('Error advancing to next track:', error);
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [next]);

  // Handle time updates for context state
  useEffect(() => {
    const video = videoManagerRef.current?.getVideoElement();
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime !== currentTime) {
        setCurrentTime(video.currentTime);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [currentTime, setCurrentTime]);

  // Page visibility optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoManagerRef.current?.getVideoElement();
      if (!video) return;

      if (document.hidden) {
        video.pause();
      } else if (isPlaying) {
        video.play().catch(() => {
          // Ignore autoplay failures when returning to visible page
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  // Fade in effect when video becomes ready
  const fadeInOpacity = isReady && !error ? 0.35 : 0;

  return (
    <>
      {/* Background video layer */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          opacity: fadeInOpacity,
          transition: 'opacity 400ms ease',
        }}
      >
        <VideoPlayer
          ref={videoElementRef}
          src={src}
          className="w-full h-full object-cover filter blur-sm"
          onReady={handleVideoReady}
          onError={handleVideoError}
          onBuffering={handleBufferingChange}
        />

        {/* Performance enhancement: additional blur overlay */}
        <div className="absolute inset-0 backdrop-blur-sm -webkit-backdrop-blur-sm" />
      </div>

      {/* Loading/Buffering indicator */}
      {(isBuffering || (!isReady && !error)) && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-black/70 backdrop-blur-sm rounded-full p-3">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="fixed top-4 left-4 z-50">
          <div className="bg-red-500/90 backdrop-blur-sm rounded-lg p-3 max-w-sm">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-white text-sm">Video Error</span>
            </div>
            <p className="text-white/80 text-xs mt-1 truncate">{error.message}</p>
          </div>
        </div>
      )}

      {/* Controls - only show when authenticated */}
      {isAuthenticated && isReady && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <ModernVideoControls filename={filename} />
        </div>
      )}


      {/* User-friendly error message for production */}
      {process.env.NODE_ENV !== 'development' && error && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-red-500/90 backdrop-blur-sm rounded-lg p-4 text-white max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span className="font-semibold">Video Unavailable</span>
          </div>
          <p className="text-sm opacity-90 mb-3">
            The background video is currently unavailable. The playlist will continue with the next track.
          </p>
          <button
            onClick={() => setError(null)}
            className="text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
