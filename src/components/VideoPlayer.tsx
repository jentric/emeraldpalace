import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useVideo } from './VideoContext';

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

  // Check browser and codec support
  const checkCodecSupport = useCallback(() => {
    const video = document.createElement('video');

    // Check for H.264 High Profile support (the problematic codec in the Rina Sawayama video)
    const h264High = video.canPlayType('video/mp4; codecs="avc1.640028"'); // H.264 High Profile
    const h264Main = video.canPlayType('video/mp4; codecs="avc1.4d401f"'); // H.264 Main Profile
    const h264Baseline = video.canPlayType('video/mp4; codecs="avc1.42e01f"'); // H.264 Baseline

    // Check for AAC audio support
    const aacLC = video.canPlayType('audio/mp4; codecs="mp4a.40.2"'); // AAC LC

    // Detect browser type for targeted fallbacks
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isFirefox = /Firefox/i.test(userAgent);
    const isChrome = /Chrome/i.test(userAgent);

    console.log('[VideoPlayer] Browser detection:', { isMobile, isSafari, isFirefox, isChrome });
    console.log('[VideoPlayer] Codec support check:', {
      h264High: h264High !== '',
      h264Main: h264Main !== '',
      h264Baseline: h264Baseline !== '',
      aacLC: aacLC !== ''
    });

    return {
      h264Supported: h264High !== '' || h264Main !== '' || h264Baseline !== '',
      h264HighSupported: h264High !== '',
      aacSupported: aacLC !== '',
      hasBasicSupport: (h264High !== '' || h264Main !== '' || h264Baseline !== '') && (aacLC !== ''),
      browser: { isMobile, isSafari, isFirefox, isChrome }
    };
  }, []);

  // Initialize HLS streaming with codec checking and better error handling
  const initializeHLS = useCallback(async (video: HTMLVideoElement, source: string) => {
    try {
      console.log('[VideoPlayer] Initializing HLS for:', source);

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
        if (codecSupport.browser.isMobile) {
          console.log('[VideoPlayer] Mobile browser detected - trying simplified HLS config');
        }
      }

      if (!codecSupport.hasBasicSupport) {
        console.warn('[VideoPlayer] Browser lacks basic codec support for H.264/AAC');

        // Try MP4 fallback immediately for incompatible browsers
        const mp4Fallback = source.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
          const baseName = match.split('/')[3];
          return `/videos/${decodeURIComponent(baseName)}.mp4`;
        });

        if (mp4Fallback !== source) {
          console.log('[VideoPlayer] Trying MP4 fallback due to codec incompatibility');
          video.src = mp4Fallback;
          return;
        }
      }

      // Dynamic import of HLS.js for better bundle splitting
      const { default: Hls } = await import('hls.js');

      console.log('[VideoPlayer] HLS.js loaded, isSupported:', Hls.isSupported());

      if (!Hls.isSupported()) {
        console.log('[VideoPlayer] HLS not supported natively, using direct src');
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
        console.log('[VideoPlayer] HLS manifest accessible');

        // Also test if we can access a segment file
        const testSegmentUrl = source.replace('index.m3u8', 'seg000.ts');
        try {
          const segmentResponse = await fetch(testSegmentUrl, { method: 'HEAD' });
          console.log('[VideoPlayer] Test segment accessible:', segmentResponse.ok, 'status:', segmentResponse.status);
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
          console.log('[VideoPlayer] Attempting MP4 fallback:', mp4Fallback);

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
          console.log('[VideoPlayer] HLS manifest not accessible, trying development test');
          // Create a simple test video element to verify the video system works
          video.src = '';
          setIsReady(true);
          onReady?.();
          return;
        }

        // Final fallback: try to load as native HLS (for Safari) or show error
        console.log('[VideoPlayer] All HLS fallbacks failed, trying native HLS support');
        video.src = source;
        return;
        throw fetchError;
      }

      const hls = new Hls({
        // Optimized configuration - even more conservative for Rina Sawayama video
        maxBufferLength: isRinaSawayama ? 10 : 20, // Extra conservative for problematic video
        maxMaxBufferLength: isRinaSawayama ? 20 : 40,
        maxBufferSize: isRinaSawayama ? 15 * 1000 * 1000 : 30 * 1000 * 1000, // Smaller buffer
        maxBufferHole: 0.5,
        // Adaptive bitrate - more conservative for problematic video
        abrEwmaDefaultEstimate: isRinaSawayama ? 500000 : 800000, // Lower bitrate estimate
        abrEwmaSlowFactor: isRinaSawayama ? 3.0 : 2.0, // Slower adaptation
        abrEwmaFastFactor: isRinaSawayama ? 0.5 : 1.0, // More conservative
        // Performance optimizations
        enableWorker: false, // Disable worker to avoid potential issues
        startLevel: isRinaSawayama ? 0 : -1, // Force lowest quality for problematic video
        // Recovery settings - more aggressive for problematic video
        maxLoadRetryCount: isRinaSawayama ? 1 : 2,
        maxFragRetryCount: isRinaSawayama ? 1 : 2,
        // Disable features that aren't needed for background video
        capLevelToPlayerSize: false,
        startFragPrefetch: false,
        // CORS and loading settings
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = false; // Disable credentials for public files
          // Add timeout for problematic video
          if (isRinaSawayama) {
            xhr.timeout = 10000; // 10 second timeout
          }
        },
        // Additional settings for problematic video
        ...(isRinaSawayama && {
          enableSoftwareAES: true,
          enableCEA708Captions: false,
          enableWebVTT: false,
          enableIMSC1: false,
          enableEMMSG: false,
          maxLoadingDelay: 4, // Shorter loading delay
        })
      });

      hlsRef.current = hls;
      hls.attachMedia(video);

      // Event handlers
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('[VideoPlayer] Media attached, loading source:', source);
        hls.loadSource(source);
      });

      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        console.log('[VideoPlayer] Manifest loading started');
      });

      hls.on(Hls.Events.MANIFEST_LOADED, (_event: any, data: any) => {
        console.log('[VideoPlayer] Manifest loaded successfully:', {
          levels: data.levels?.length,
          audioTracks: data.audioTracks?.length,
          subtitles: data.subtitles?.length,
          url: data.url
        });
        setIsReady(true);
        onReady?.();
      });

      hls.on(Hls.Events.LEVEL_LOADING, (_event: any, data: any) => {
        console.log('[VideoPlayer] Level loading:', data.level);
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event: any, data: any) => {
        console.log('[VideoPlayer] Level loaded:', data.level, 'details:', data.details);
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

      // Add some debug logging
      hls.on(Hls.Events.FRAG_LOADED, (_event: any, data: any) => {
        console.log('[VideoPlayer] Fragment loaded:', data.frag?.url);
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
    if (!video) return;

    console.log('[VideoPlayer] Initializing video for:', src);

    // Reset state
    setError(null);
    setIsReady(false);
    setIsBuffering(true);

    // Set optimized video attributes
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = muted;
    video.volume = volume;
    video.autoplay = true;
    video.loop = false;

    // Performance optimizations
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    // Check if source is HLS
    const isHLS = src.includes('.m3u8');

    try {
      if (isHLS) {
        console.log('[VideoPlayer] Detected HLS source, initializing HLS player');
        await initializeHLS(video, src);
      } else {
        console.log('[VideoPlayer] Loading regular video source');
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
  }, [src, muted, volume, initializeHLS, onReady, onError]);

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
  }, [initializeVideo, onReady]);

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
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading video - check your internet connection';
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
                });

                console.log('[VideoPlayer] Initializing fallback HLS with minimal config');
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
          errorMessage = 'Video decoding error - video file may be corrupted';
          break;
        default:
          errorMessage = videoError.message || 'Video playback error';
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
