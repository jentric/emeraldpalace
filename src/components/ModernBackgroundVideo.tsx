import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVideo } from './VideoContext';
import { useConvexAuth } from 'convex/react';
import VideoPlayer from './VideoPlayer';
import { VideoManager } from './VideoManager';
import { videoCache } from './VideoCache';
import { performanceMonitor, QualityRecommendation } from './VideoPerformanceMonitor';
import ModernVideoControls from './ModernVideoControls';

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
  const [consecutiveCodecErrors, setConsecutiveCodecErrors] = useState(0);

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
        console.log(`[ModernBackgroundVideo] Loading video: ${filename} (index: ${currentIndex})`);
        setError(null);
        setConsecutiveCodecErrors(0); // Reset codec error counter on successful video load
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

        // Load current video
        await videoManagerRef.current!.loadSource(src, {
          muted: !isAuthenticated || muted,
          volume,
          autoplay: true,
          loop: false,
          preload: isAuthenticated ? 'auto' : 'metadata',
        });

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

    // Check if this is a format/codec error that suggests the video files are problematic
    const isFormatError = error.message.includes('format not supported') ||
                         error.message.includes('decoding error') ||
                         error.message.includes('codec') ||
                         error.message.includes('Video format not supported');

    if (isFormatError) {
      console.log(`[ModernBackgroundVideo] Format/codec error detected for ${filename} - this video may be corrupted or incompatible`);

      // Track consecutive codec errors
      setConsecutiveCodecErrors(prev => {
        const newCount = prev + 1;
        console.log(`[ModernBackgroundVideo] Consecutive codec errors: ${newCount}`);

        // If we've had 3+ consecutive codec errors, the entire playlist might have codec issues
        if (newCount >= 3) {
          console.warn('[ModernBackgroundVideo] Multiple videos failing with codec errors - this may be a browser compatibility issue');
        }

        return newCount;
      });

      // Clear error state and force video reload
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Clearing error state and forcing reload');
        setError(null);
        // Force a re-render by updating a state that triggers the video loading effect
        setIsBuffering(true);
      }, 200);

      // For format errors, advance to next video after a short delay
      setTimeout(() => {
        console.log('[ModernBackgroundVideo] Auto-advancing to next video due to format error');
        try {
          next();
        } catch (nextError) {
          console.error('Failed to advance to next video:', nextError);
        }
      }, 1000); // Give reset a chance to work first
    } else {
      // For network or temporary errors, reset codec error counter
      setConsecutiveCodecErrors(0);

      // For network or temporary errors, wait longer before retrying
      console.log('Network or temporary error detected - waiting before advancing');
      setTimeout(() => {
        console.log('Auto-advancing to next video due to error');
        try {
          next();
        } catch (nextError) {
          console.error('Failed to advance to next video:', nextError);
        }
      }, 3000); // Longer delay for network errors
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

      {/* Performance debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 left-4 z-50 bg-black/70 backdrop-blur-sm rounded p-2 text-white text-xs font-mono max-w-sm">
          <div>FPS: {performanceMonitor.getCurrentMetrics().fps.toFixed(1)}</div>
          <div>Buffered: {isBuffering ? 'Yes' : 'No'}</div>
          <div>Cache: {videoCache.getStats().entries} entries</div>
          <div>Ready: {isReady ? 'Yes' : 'No'}</div>
          <div>Error: {error ? 'Yes' : 'No'}</div>
          <div>Current: {currentIndex + 1}/{playlist.length}</div>
          <div className="truncate">Video: {filename}</div>
          <div>Codec Errors: {consecutiveCodecErrors}</div>
          {error && (
            <div className="text-red-300 mt-1">
              <div className="truncate">Err: {error.message}</div>
              <div className="text-xs text-gray-400 truncate">File: {filename}</div>
              {error.message.includes('format not supported') && (
                <div className="text-yellow-300">→ HLS/Codec Issue</div>
              )}
              {error.message.includes('Video format not supported') && (
                <div className="text-orange-300">→ General Codec Issue</div>
              )}
              {error.message.includes('network') && (
                <div className="text-blue-300">→ Network Issue</div>
              )}
              {(filename && (filename.includes('Rina Sawayama') || filename.includes('Michelle Branch') || error.message.includes('codec'))) && (
                <div className="text-purple-300">→ H.264 High Profile Issue</div>
              )}
            </div>
          )}
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
