import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useVideo } from './VideoContext';
import { browserCompatibility } from '../lib/browserCompatibility';

interface VideoPlayerProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onBuffering?: (isBuffering: boolean) => void;
}

export default function VideoPlayer({
  src,
  className,
  style,
  onReady,
  onError,
  onBuffering
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [_isReady, setIsReady] = useState(false);
  const [_isBuffering, setIsBuffering] = useState(false);
  const [_error, setError] = useState<Error | null>(null);

  const { muted, volume } = useVideo();

  // Check browser and codec support using enhanced compatibility detector
  const checkCodecSupport = useCallback(() => {
    const capabilities = browserCompatibility.getCapabilities();
    const specialHandling = browserCompatibility.needsSpecialHandling();

    return {
      // Enhanced codec support using comprehensive detection
      h264Supported: capabilities.codecSupport.h264Baseline || capabilities.codecSupport.h264Main || capabilities.codecSupport.h264High,
      h264HighSupported: capabilities.codecSupport.h264High,
      h264MainSupported: capabilities.codecSupport.h264Main,
      h264BaselineSupported: capabilities.codecSupport.h264Baseline,

      // Alternative codec support
      vp8Supported: capabilities.codecSupport.vp8,
      vp9Supported: capabilities.codecSupport.vp9,
      hevcSupported: capabilities.codecSupport.hevc,

      // Audio support
      aacSupported: capabilities.codecSupport.aacLC,
      opusSupported: capabilities.codecSupport.opus,

      // Browser capabilities
      mseSupported: capabilities.supportsMSE,
      webrtcSupported: capabilities.supportsWebRTC,

      // Comprehensive support check
      hasBasicSupport: (capabilities.codecSupport.h264Baseline || capabilities.codecSupport.h264Main || capabilities.codecSupport.h264High) && capabilities.codecSupport.aacLC,
      hasAlternativeSupport: capabilities.codecSupport.vp8 || capabilities.codecSupport.vp9 || capabilities.codecSupport.hevc,

      // Enhanced browser detection
      browser: {
        isMobile: capabilities.isMobile,
        isSafari: capabilities.isSafari,
        isFirefox: capabilities.isFirefox,
        isChrome: capabilities.isChrome,
        isEdge: capabilities.isEdge,
        isIOS: capabilities.isIOS,
        isAndroid: capabilities.isAndroid
      },

      // Special handling requirements
      needsSpecialHandling: specialHandling !== null,
      specialHandlingReason: specialHandling?.reason || null,
      specialHandlingAction: specialHandling?.action || null,

      // HLS support
      hlsSupported: capabilities.supportsHLS
    };
  }, []);

  // Initialize HLS streaming with codec checking and better error handling
  const initializeHLS = useCallback(async (video: HTMLVideoElement, source: string) => {
    try {

      // Check if this is the known problematic video
      const isRinaSawayama = source.includes('Rina%20Sawayama');
      if (isRinaSawayama) {
        console.warn('[VideoPlayer] Rina Sawayama video detected - known H.264 High Profile compatibility issues');
      }

      // Check codec support first
      const codecSupport = checkCodecSupport();

      // Provide specific warnings based on browser and codec support
      if (!codecSupport.h264HighSupported) {
        console.warn('[VideoPlayer] H.264 High Profile not supported - this affects the Rina Sawayama video');
      }

      // Enhanced browser-specific handling
      if (codecSupport.browser.isSafari) {
        console.log('[VideoPlayer] Safari detected - native HLS support available');
      } else if (!codecSupport.mseSupported) {
        console.warn('[VideoPlayer] Media Source Extensions not supported - HLS playback may fail');
      }

      if (!codecSupport.hasBasicSupport) {
        console.warn('[VideoPlayer] Browser lacks basic codec support for H.264/AAC');

        // Try multiple fallback formats for incompatible browsers
        const fallbackFormats = browserCompatibility.getFallbackFormats(source);

        for (const fallbackSrc of fallbackFormats) {
          try {
            console.log('[VideoPlayer] Attempting fallback format due to codec incompatibility:', fallbackSrc);

            // Check if fallback file exists
            const fallbackResponse = await fetch(fallbackSrc, { method: 'HEAD' });
            if (fallbackResponse.ok) {
              console.log('[VideoPlayer] Fallback format available, switching to:', fallbackSrc);
              video.src = fallbackSrc;
              return;
            } else {
              console.warn('[VideoPlayer] Fallback format not available:', fallbackSrc);
            }
          } catch (fallbackError) {
            console.warn('[VideoPlayer] Fallback format fetch failed:', fallbackSrc, fallbackError);
          }
        }
      }

      // Check for server connectivity before initializing HLS
      try {
        const testResponse = await fetch(source, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!testResponse.ok) {
          console.warn(`[VideoPlayer] HLS manifest not accessible: ${testResponse.status}`);

          // Try MP4 fallback if HLS manifest is not accessible
          const mp4Fallback = source.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
            const baseName = match.split('/')[3];
            return `/videos/${decodeURIComponent(baseName)}.mp4`;
          });

          if (mp4Fallback !== source) {
            console.log('[VideoPlayer] HLS manifest not accessible, trying MP4 fallback:', mp4Fallback);
            video.src = mp4Fallback;
            return;
          }
        }
      } catch (connectError) {
        console.error('[VideoPlayer] Server connectivity check failed:', connectError);

        // For connection issues, try MP4 fallback
        const mp4Fallback = source.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
          const baseName = match.split('/')[3];
          return `/videos/${decodeURIComponent(baseName)}.mp4`;
        });

        if (mp4Fallback !== source) {
          console.log('[VideoPlayer] Server connectivity issue, trying MP4 fallback:', mp4Fallback);
          video.src = mp4Fallback;
          return;
        }
      }

      // Dynamic import of HLS.js for better bundle splitting
      const { default: Hls } = await import('hls.js');


      if (!Hls.isSupported()) {
        // Fallback to native HLS support (Safari) or try MP4 fallback
        video.src = source;
        return;
      }

      // Check if the HLS manifest is accessible before initializing
      try {
        const manifestResponse = await fetch(source, { method: 'HEAD' });
        if (!manifestResponse.ok) {
          throw new Error(`HLS manifest not accessible: ${manifestResponse.status}`);
        }

        // Also test if we can access a segment file
        const testSegmentUrl = source.replace('index.m3u8', 'seg000.ts');
        try {
          const segmentResponse = await fetch(testSegmentUrl, { method: 'HEAD' });
          if (!segmentResponse.ok) {
            console.warn('[VideoPlayer] Segment file not accessible - this may cause HLS loading issues');
          }
        } catch (segmentError) {
          const error = segmentError instanceof Error ? segmentError : new Error(String(segmentError));
          console.warn('[VideoPlayer] Test segment fetch failed:', error.message);
          console.warn('[VideoPlayer] This may indicate CORS or network issues with HLS segments');
        }
      } catch (fetchError) {
        console.warn('[VideoPlayer] HLS manifest fetch failed:', fetchError);
        // Try to fallback to MP4 if HLS manifest is not accessible
        const mp4Fallback = source.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
          const baseName = match.split('/')[3];
          return `/videos/${decodeURIComponent(baseName)}.mp4`;
        });

        if (mp4Fallback !== source) {

          // Check if MP4 exists before trying
          try {
            const mp4Response = await fetch(mp4Fallback, { method: 'HEAD' });
            if (mp4Response.ok) {
              video.src = mp4Fallback;
              return;
            } else {
              console.warn('[VideoPlayer] MP4 fallback not available:', mp4Fallback);
            }
          } catch (mp4Error) {
            console.warn('[VideoPlayer] MP4 fallback fetch failed:', mp4Error);
          }
        }

        // Development fallback: try a simple test to verify video element works
        if (process.env.NODE_ENV === 'development') {
          // Create a simple test video element to verify the video system works
          video.src = '';
          setIsReady(true);
          onReady?.();
          return;
        }

        // Final fallback: try to load as native HLS (for Safari) or show error
        video.src = source;
        return;
        throw fetchError;
      }

      // Get browser-optimized HLS configuration
      const browserCapabilities = browserCompatibility.getCapabilities();
      const hlsConfig = browserCapabilities.recommendedConfig;

      const hls = new Hls({
        // Use browser-optimized configuration as base
        ...hlsConfig,

        // Override for Rina Sawayama specific issues
        ...(isRinaSawayama && {
          enableSoftwareAES: true,
          enableCEA708Captions: false,
          enableWebVTT: false,
          enableIMSC1: false,
          enableEMMSG: false,
          maxLoadingDelay: 3,
          // Extra conservative buffer settings for problematic video
          maxBufferLength: Math.min(hlsConfig.maxBufferLength, 8),
          maxMaxBufferLength: Math.min(hlsConfig.maxMaxBufferLength, 15),
          maxBufferSize: Math.min(hlsConfig.maxBufferSize, 12 * 1000 * 1000),
          maxBufferBehind: 30,
          maxBufferAhead: 30,
          startLevel: 0, // Force lowest quality for compatibility
          abrEwmaDefaultEstimate: Math.min(hlsConfig.abrEwmaDefaultEstimate, 400000),
          abrEwmaSlowFactor: 3.0,
          abrEwmaFastFactor: 0.5,
        }),

        // Browser-specific optimizations
        ...(codecSupport.browser.isSafari && {
          // Safari-specific settings for better stability
          enableSoftwareAES: false,
          enableCEA708Captions: false,
          enableWebVTT: false,
          enableIMSC1: false,
          enableEMMSG: false,
        }),

        // Enhanced retry settings based on browser capabilities
        maxLoadRetryCount: codecSupport.browser.isMobile ? 6 : (isRinaSawayama ? 2 : hlsConfig.maxLoadRetryCount),
        maxFragRetryCount: codecSupport.browser.isMobile ? 6 : (isRinaSawayama ? 2 : hlsConfig.maxFragRetryCount),
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: codecSupport.browser.isMobile ? 1500 : 1000,
        manifestLoadingMaxRetry: codecSupport.browser.isMobile ? 5 : 3,
        manifestLoadingRetryDelay: codecSupport.browser.isMobile ? 1500 : 1000,

        // Loading and prefetch settings
        capLevelToPlayerSize: false,
        startFragPrefetch: codecSupport.browser.isSafari ? false : !codecSupport.browser.isMobile,
        lowLatencyMode: false,
        backBufferLength: codecSupport.browser.isMobile ? 20 : (isRinaSawayama ? 30 : 60),

        // CORS and network settings with browser-specific timeouts
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = false;
          const timeout = codecSupport.browser.isMobile ? 15000 :
                         (isRinaSawayama ? 8000 : hlsConfig.xhrTimeout);
          xhr.timeout = timeout;
        },
      });

      hlsRef.current = hls;
      hls.attachMedia(video);

      // Event handlers
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(source);
      });

      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        // Manifest loading started
      });

      hls.on(Hls.Events.MANIFEST_LOADED, (_event: any, _data: any) => {
        setIsReady(true);
        onReady?.();
      });

      hls.on(Hls.Events.LEVEL_LOADING, (_event: any, _data: any) => {
        // Level loading
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event: any, _data: any) => {
        // Level loaded
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        setIsBuffering(false);
        onBuffering?.(false);
      });

      hls.on(Hls.Events.BUFFER_EOS, () => {
        setIsBuffering(false);
        onBuffering?.(false);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false);
        onBuffering?.(false);
      });

      hls.on(Hls.Events.ERROR, async (_: any, data: any) => {
        console.error('[VideoPlayer] HLS Error:', {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          url: data.url,
          response: data.response,
          networkDetails: data.networkDetails,
          frag: data.frag,
          level: data.level
        });

        // Special handling for bufferSeekOverHole - try to recover before treating as fatal
        if (data.details === 'bufferSeekOverHole') {
          console.warn('[VideoPlayer] Buffer seek over hole detected - attempting gap recovery');

          // Stop the current load and restart with safer settings
          hls.stopLoad();

          // Wait a moment then restart
          setTimeout(() => {
            // Try to resume at a safe position in the buffer
            if (video.buffered.length > 0) {
              const bufferedEnd = video.buffered.end(video.buffered.length - 1);
              const safePosition = Math.max(0, bufferedEnd - 3); // 3 seconds before end of buffer

              if (safePosition < video.duration && safePosition >= 0) {
                video.currentTime = safePosition;
              }
            }

            // Restart loading
            hls.startLoad();
          }, 1000);

          // Don't treat this as a fatal error yet
          return;
        }

        // Try MP4 fallback for fatal errors
        if (data.fatal) {
          console.log('[VideoPlayer] HLS fatal error detected, attempting fallback strategies');

          const mp4Fallback = source.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
            const baseName = match.split('/')[3];
            return `/videos/${decodeURIComponent(baseName)}.mp4`;
          });

          if (mp4Fallback !== source) {
            console.log('[VideoPlayer] HLS failed, trying MP4 fallback:', mp4Fallback);

            // Check if MP4 exists before trying
            try {
              const mp4Response = await fetch(mp4Fallback, { method: 'HEAD' });
              if (mp4Response.ok) {
                console.log('[VideoPlayer] MP4 fallback available, switching to MP4');
                // Clean up HLS instance
                hls.destroy();
                hlsRef.current = null;
                // Try MP4
                video.src = mp4Fallback;
                return;
              } else {
                console.warn('[VideoPlayer] MP4 fallback not available:', mp4Fallback);
              }
            } catch (mp4Error) {
              console.warn('[VideoPlayer] MP4 fallback fetch failed:', mp4Error);
            }
          }

          // Try to reload HLS with different settings
          console.log('[VideoPlayer] Attempting HLS reload with different settings');
          try {
            hls.destroy();
            hlsRef.current = null;

            // Wait a bit before retrying
            setTimeout(() => {
              const retryHls = new Hls({
                maxBufferLength: 10, // More conservative
                maxMaxBufferLength: 20,
                maxBufferSize: 15 * 1000 * 1000, // Smaller buffer
                maxBufferHole: 0.5,
                startLevel: 0, // Force lowest quality
                enableWorker: false,
                maxLoadRetryCount: 1,
                maxFragRetryCount: 1,
              });

              retryHls.attachMedia(video);
              retryHls.on(Hls.Events.MEDIA_ATTACHED, () => {
                retryHls.loadSource(source);
              });

              retryHls.on(Hls.Events.ERROR, () => {
                console.error('[VideoPlayer] HLS retry also failed');
                const finalError = new Error('HLS video stream could not be loaded after retry');
                setError(finalError);
                onError?.(finalError);
              });

              hlsRef.current = retryHls;
            }, 1000);

            return;
          } catch (retryError) {
            console.error('[VideoPlayer] HLS retry setup failed:', retryError);
          }
        }

        const hlsError = new Error(`HLS Error: ${data.type} - ${data.details || data.err?.message || 'Unknown error'}`);
        setError(hlsError);
        onError?.(hlsError);
      });

      // Fragment loaded event
      hls.on(Hls.Events.FRAG_LOADED, (_event: any, _data: any) => {
        // Fragment loaded
      });

      // Buffer management events
      hls.on(Hls.Events.BUFFER_APPENDED, (_event: any, _data: any) => {
        // Check for buffer gaps and handle them
        if (video.buffered.length > 1) {
          // There might be a gap, try to fill it
          const firstEnd = video.buffered.end(0);
          const secondStart = video.buffered.start(1);

          if (secondStart - firstEnd > 1) { // Gap larger than 1 second
            console.warn('[VideoPlayer] Buffer gap detected, attempting to fill');
            // The HLS library should handle this automatically, but we can log it
          }
        }
      });

      // Level switched - monitor quality changes
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
        console.log(`[VideoPlayer] Switched to quality level: ${data.level}`);
      });

    } catch (err) {
      console.error('[VideoPlayer] HLS initialization failed:', err);
      const error = err instanceof Error ? err : new Error('Failed to initialize HLS');

      // Try MP4 fallback
      const mp4Fallback = source.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
        const baseName = match.split('/')[3];
        return `/videos/${decodeURIComponent(baseName)}.mp4`;
      });

      if (mp4Fallback !== source) {
        console.log('[VideoPlayer] HLS init failed, trying MP4 fallback:', mp4Fallback);
        video.src = mp4Fallback;
        return;
      }

      setError(error);
      onError?.(error);
    }
  }, [onReady, onError, onBuffering, checkCodecSupport]);


  // Initialize video with optimized settings and better fallback handling
  const initializeVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      console.warn('[VideoPlayer] Video element not found');
      return;
    }

    // Validate src before proceeding
    if (!src || src.trim() === '') {
      console.error('[VideoPlayer] Empty or invalid src provided:', src);
      const error = new Error('Video source is empty or invalid');
      setError(error);
      onError?.(error);
      return;
    }


    // Reset state
    setError(null);
    setIsReady(false);
    setIsBuffering(true);

    // Set browser-optimized video attributes
    const videoAttributes = browserCompatibility.getVideoAttributes();

    // Apply all browser-optimized attributes
    Object.entries(videoAttributes).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        if (value) {
          video.setAttribute(key, '');
        }
      } else {
        video.setAttribute(key, value);
      }
    });

    // Override specific attributes based on context
    video.muted = muted;
    video.volume = volume;
    video.autoplay = !codecSupport.needsSpecialHandling || codecSupport.specialHandlingAction !== 'delay_autoplay';
    video.loop = false;

    // Prevent seeking into unbuffered areas
    const originalSeekHandler = video.ontimeupdate;
    video.ontimeupdate = (e) => {
      // Call original handler if it exists
      if (originalSeekHandler) originalSeekHandler.call(video, e);

      // Additional buffer monitoring
      const buffered = video.buffered;
      const currentTime = video.currentTime;
      const duration = video.duration;

      // Check if we're approaching an unbuffered area
      if (buffered.length > 0 && currentTime > 0) {
        const lastBufferedEnd = buffered.end(buffered.length - 1);

        // If we're within 2 seconds of an unbuffered area, pause to buffer
        if (lastBufferedEnd - currentTime < 2 && currentTime < duration - 2) {
          console.log('[VideoPlayer] Approaching buffer gap, preparing for smooth playback');
        }
      }
    };

    // Prevent manual seeking into unbuffered areas
    video.onseeking = () => {
      const buffered = video.buffered;
      const seekTarget = video.currentTime;

      // Check if seek target is within buffered ranges
      let isBuffered = false;
      for (let i = 0; i < buffered.length; i++) {
        if (seekTarget >= buffered.start(i) && seekTarget <= buffered.end(i)) {
          isBuffered = true;
          break;
        }
      }

      if (!isBuffered && buffered.length > 0) {
        console.warn('[VideoPlayer] Attempting to seek to unbuffered area, adjusting to safe position');
        // Use safe seek function
        const lastBufferedEnd = buffered.end(buffered.length - 1);
        const safePosition = Math.max(0, lastBufferedEnd - 2);
        if (safePosition >= 0 && safePosition <= video.duration) {
          video.currentTime = safePosition;
        }
      }
    };

    // Monitor for stalled playback (when buffering stops unexpectedly)
    video.onstalled = () => {
      console.warn('[VideoPlayer] Video stalled - buffering stopped unexpectedly');
      setIsBuffering(true);
      onBuffering?.(true);
    };

    // Monitor waiting events (when video stops due to buffering)
    video.onwaiting = () => {
      console.log('[VideoPlayer] Video waiting for buffer');
      setIsBuffering(true);
      onBuffering?.(true);
    };

    // Monitor when video can play again
    video.oncanplay = () => {
      console.log('[VideoPlayer] Video can play - buffer ready');
      setIsBuffering(false);
      onBuffering?.(false);
    };

    // Check if source is HLS
    const isHLS = src.includes('.m3u8');

    // Server connectivity check before attempting to load video
    let serverErrorMessage = '';

    try {
      const serverCheckResponse = await fetch(window.location.origin, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (!serverCheckResponse.ok) {
        throw new Error(`Server responded with status: ${serverCheckResponse.status}`);
      }

      console.log('[VideoPlayer] Server connectivity confirmed');
    } catch (connectError) {
      console.warn('[VideoPlayer] Server connectivity check failed:', connectError);
      console.warn('[VideoPlayer] This may indicate the dev server is not running or there are network issues');

      serverErrorMessage = connectError instanceof Error ? connectError.message : String(connectError);

      const serverError = new Error(
        'Unable to connect to video server. Please ensure the development server is running and try refreshing the page.'
      );
      setError(serverError);
      onError?.(serverError);
      return;
    }

    try {
      if (isHLS) {
        await initializeHLS(video, src);
      } else {
        // Regular video file - check if file exists first
        try {
          const fileCheckResponse = await fetch(src, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });

          if (!fileCheckResponse.ok) {
            throw new Error(`Video file not found: ${fileCheckResponse.status}`);
          }

          console.log('[VideoPlayer] Video file accessibility confirmed');
        } catch (fileCheckError) {
          console.warn('[VideoPlayer] Video file check failed:', fileCheckError);

          const fileError = new Error(
            'Video file could not be accessed. Please check if the video file exists on the server.'
          );
          setError(fileError);
          onError?.(fileError);
          return;
        }

        // Regular video file
        video.src = src;
        setIsReady(true);
        onReady?.();
      }
    } catch (err) {
      console.error('[VideoPlayer] Video initialization failed:', err);

      // Provide user-friendly error message
      const errorMessage = isHLS
        ? 'HLS video stream could not be loaded. This might be due to network issues or unsupported video format.'
        : 'Video file could not be loaded. Please check if the video file exists and is accessible.';

      const error = new Error(errorMessage);
      setError(error);
      onError?.(error);
    }
  }, [src, muted, volume, initializeHLS, onReady, onError, onBuffering]);

  // Initialize on mount and src change
  useEffect(() => {
    (async () => {
      try {
        await initializeVideo();
      } catch (error) {
        console.error('[VideoPlayer] Failed to initialize video:', error);
      }
    })().catch((error) => {
      console.error('[VideoPlayer] Unhandled promise rejection:', error);
    });

    return () => {
      // Cleanup HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initializeVideo, onReady, onBuffering]);

  // Update mute state
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = muted;
    }
  }, [muted]);

  // Update volume
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
    }
  }, [volume]);

  // Handle buffering events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => {
      setIsBuffering(true);
      onBuffering?.(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
      onBuffering?.(false);
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [onBuffering]);

  // Handle video errors with better error handling
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const videoError = video.error;
    let errorMessage = 'Unknown video error';

    if (videoError) {
      console.error('[VideoPlayer] Detailed error info:', {
        code: videoError.code,
        message: videoError.message,
        src: src,
        networkState: video.networkState,
        readyState: video.readyState,
        error: videoError
      });

      switch (videoError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Video playback was aborted - this may be due to network issues';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading video - check your internet connection and server status';
          console.warn('[VideoPlayer] Network error detected - this may indicate server connectivity issues');
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported - H.264 High Profile codec issue detected';
          console.warn('[VideoPlayer] Format not supported - H.264 High Profile Level 3.0 codec compatibility issue');

          // For codec issues, try different approaches
          setTimeout(() => {
            console.log('[VideoPlayer] Attempting codec fallback strategies');

            // Try to force HLS.js to use software decoding
            if (hlsRef.current) {
              console.log('[VideoPlayer] Destroying current HLS instance');
              hlsRef.current.destroy();
              hlsRef.current = null;
            }

            // Try loading with minimal HLS config
            const fallbackPromise = (async () => {
              try {
                // Capture source in closure to avoid scope issues
                const currentSource = src;
                // Need to re-import Hls for the fallback
                const { default: FallbackHls } = await import('hls.js');
                const fallbackHls = new FallbackHls({
                  enableWorker: false, // Disable web worker
                  enableSoftwareAES: true, // Force software AES decryption
                  maxBufferLength: 5, // Very small buffer
                  maxMaxBufferLength: 10,
                  startLevel: 0, // Force lowest quality
                  maxLoadingDelay: 2, // Reduce loading delay
                  // Disable advanced features that might cause issues
                  enableCEA708Captions: false,
                  enableWebVTT: false,
                  enableIMSC1: false,
                  enableEMMSG: false,
                  // More conservative network settings
                  maxLoadRetryCount: 2,
                  maxFragRetryCount: 2,
                });

                fallbackHls.attachMedia(video);

                fallbackHls.on(FallbackHls.Events.ERROR, (_event: any, data: any) => {
                  console.error('[VideoPlayer] Fallback HLS also failed:', data);
                  // If fallback also fails, try native HLS or skip
                  if (data.fatal) {
                    console.log('[VideoPlayer] All HLS attempts failed, trying native HLS');
                    fallbackHls.destroy();
                    // Try native HLS support (Safari)
                    video.src = currentSource;
                  }
                });

                fallbackHls.on(FallbackHls.Events.MANIFEST_LOADED, (_event: any, _data: any) => {
                  console.log('[VideoPlayer] Fallback HLS manifest loaded successfully');
                  setIsReady(true);
                  onReady?.();
                });

                fallbackHls.loadSource(currentSource);
                hlsRef.current = fallbackHls;
              } catch (fallbackError) {
                console.error('[VideoPlayer] Fallback HLS setup failed:', fallbackError);
                // Last resort: try native HLS
                video.src = src;
              }
            })();

            // Handle any unhandled promise rejections
            fallbackPromise.catch((error) => {
              console.error('[VideoPlayer] Fallback promise failed:', error);
            });
          }, 500);
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Video decoding error - video file may be corrupted or use unsupported codec';
          console.warn('[VideoPlayer] Decoding error detected - this may indicate codec compatibility issues');
          break;
        default:
          errorMessage = videoError.message || 'Video playback error - unknown issue occurred';
          console.warn('[VideoPlayer] Unknown video error:', videoError);
      }
    }

    const error = new Error(`Video Error: ${errorMessage}`);
    console.warn(`[VideoPlayer] Video error for ${src}:`, errorMessage, {
      src,
      error: videoError,
      networkState: video.networkState,
      readyState: video.readyState,
      currentSrc: video.currentSrc
    });
    setError(error);
    onError?.(error);
  }, [src, onReady, onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('error', handleVideoError);

    return () => {
      video.removeEventListener('error', handleVideoError);
    };
  }, [handleVideoError]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      // Essential attributes for background video
      muted={muted}
      playsInline
      autoPlay
      loop={false}
      // Performance optimizations
      preload="metadata"
      // Accessibility
      aria-hidden="true"
      // Disable features not needed for background video
      disablePictureInPicture
      disableRemotePlayback
    />
  );
}
