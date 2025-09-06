import React, { useEffect, useRef, forwardRef } from "react";

type HlsPlayerProps = React.ComponentPropsWithoutRef<"video"> & {
  src: string;
  /**
   * Optional runtime overrides for hls.js config.
   * Example: { maxBufferLength: 20, enableWorker: false }
   */
  hlsConfig?: Record<string, any>;
  /**
   * Enable debug logging for hls.js events and internal decisions.
   */
  debug?: boolean;
};

/**
 * HlsPlayer
 * - Dynamically imports hls.js at runtime when an HLS manifest is detected and when native HLS is not available.
 * - Falls back to setting video.src directly for non-HLS or native-supporting browsers.
 * - Forwards the ref to the underlying HTMLVideoElement so callers can add event listeners / call play/pause.
 */
const HlsPlayer = forwardRef<HTMLVideoElement, HlsPlayerProps>(({ src, ...props }, ref) => {
  const internalRef = useRef<HTMLVideoElement | null>(null);

  // Keep a ref to Hls instance so we can destroy on cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const video = (ref as any)?.current ?? internalRef.current;
    if (!video) {
      console.error("[HlsPlayer] No video element found");
      return;
    }

    console.log("[HlsPlayer] Initializing with src:", src);

    // Declare detach function placeholder so cleanup can access it regardless of init outcome
    let detachHlsListeners: (() => void) | undefined;

    const isHlsManifest = typeof src === "string" && src.toLowerCase().includes(".m3u8");
    console.log("[HlsPlayer] Is HLS manifest:", isHlsManifest, "src:", src);

    // If browser supports HLS natively (Safari), just set src
    const nativeHls = Boolean(video.canPlayType && video.canPlayType("application/vnd.apple.mpegurl"));
    console.log("[HlsPlayer] Native HLS support:", nativeHls);

    let cancelled = false;

    async function setupHls() {
      if (!isHlsManifest) {
        // Not an HLS manifest; set src directly
        console.log("[HlsPlayer] Setting direct src:", src);
        try {
          if (video.src !== src) {
            video.src = src;
            console.log("[HlsPlayer] Direct src set successfully");
          }
        } catch (err) {
          console.error("[HlsPlayer] Failed to set direct src:", err);
        }
        return;
      }

      if (nativeHls) {
        // Native HLS support (Safari); set src directly
        console.log("[HlsPlayer] Using native HLS support");
        try {
          if (video.src !== src) {
            video.src = src;
            console.log("[HlsPlayer] Native HLS src set");
          }
        } catch (err) {
          console.error("[HlsPlayer] Failed to set native HLS src:", err);
        }
        return;
      }

      try {
        // Dynamically import hls.js to avoid static import/type errors and reduce initial bundle
        const mod: any = await import("hls.js");
        if (cancelled) return;
        const Hls = mod?.default ?? mod;

        if (!Hls || !Hls.isSupported?.()) {
          console.warn("[HlsPlayer] HLS.js not supported, falling back to direct src");
          // Fallback
          try { video.src = src; } catch { /* no-op */ }
          return;
        }
 
        // Clean up previous instance
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch { /* no-op */ }
          hlsRef.current = null;
        }
 
        // Optimized HLS config for smooth, gapless playback
        const baseConfig: Record<string, any> = {
          // Buffer management: larger buffers for smoother playback, but not excessive
          maxBufferLength: 45, // Increased from 30 to reduce stalls
          maxMaxBufferLength: 90, // Increased proportionally
          maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer size
          maxBufferHole: 0.5, // Allow small holes to fill
          // ABR: more aggressive adaptation for better quality/smoothness balance
          abrEwmaDefaultEstimate: 800000, // Higher bitrate estimate
          abrEwmaSlowFactor: 2.5, // Faster adaptation
          abrEwmaFastFactor: 0.7, // More responsive
          abrBandWidthFactor: 0.95, // Conservative bandwidth usage
          abrBandWidthUpFactor: 0.7, // Faster upscaling
          // Playback: reduce seeking issues and gaps
          maxSeekHole: 1.5, // Smaller seek hole tolerance
          maxFragLookUpTolerance: 0.25, // Better fragment lookup
          // Performance: enable worker for non-blocking processing
          enableWorker: true,
          // Loader: optimize segment loading
          loader: undefined, // Use default loader
          fLoader: undefined,
          pLoader: undefined,
          // Misc: prevent duplicates and improve recovery
          capLevelToPlayerSize: true,
          startLevel: -1, // Auto-select best level
          autoStartLoad: true,
          testBandwidth: true,
        };

        // Mobile optimizations: smaller buffers to reduce memory pressure
        try {
          const width = video.clientWidth || (window.innerWidth || 0);
          if (width && width < 600) {
            baseConfig.maxBufferLength = 20; // Slightly larger than before for better smoothness
            baseConfig.maxMaxBufferLength = 40;
            baseConfig.maxBufferSize = 30 * 1000 * 1000; // 30MB for mobile
            baseConfig.abrEwmaDefaultEstimate = 400000; // Moderate bitrate
            baseConfig.abrEwmaSlowFactor = 3.5;
            baseConfig.abrEwmaFastFactor = 0.5;
          }
        } catch { /* no-op */ }

        // Merge caller-provided overrides
        const callerConfig = (props as any).hlsConfig || {};
        const finalConfig = { ...baseConfig, ...callerConfig };

        // Force URL normalization so hls.js receives a safe, encoded URL
        try {
          const url = new URL(src, window.location.origin);
          // optional: nothing to do, the constructor validates
          // eslint-disable-next-line no-unused-expressions
          url.toString();
        } catch {
          // If src is a relative path with unsafe chars, encode each segment
          try {
            const parts = src.split("/").map((seg) => seg.includes(".m3u8") ? seg : encodeURIComponent(seg));
            src = parts.join("/");
          } catch { /* no-op */ }
        }

        // Instantiate Hls (use any typing for runtime interop)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const HlsCtor: any = Hls;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hls: any = new HlsCtor(finalConfig);
        hlsRef.current = hls;
        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log("[HlsPlayer] Media attached, loading source:", src);
          try { hls.loadSource(src); } catch (err) {
            console.error("[HlsPlayer] Failed to load source:", err);
          }
          // mark that hls.js is managing this media element (used by e2e tests)
          try { video.setAttribute("data-hls-managed", "true"); } catch { /* no-op */ }
        });

        // Add manifest loaded event to debug
        hls.on(Hls.Events.MANIFEST_LOADED, (event: any, data: any) => {
          console.log("[HlsPlayer] Manifest loaded successfully:", data);
        });

        // Add fragment loaded event to debug
        hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
          console.log("[HlsPlayer] Fragment loaded:", data.frag.url);
        });
  
        // Debug flag for logging
        const isDebug = Boolean((props as any).debug);
  
        // Enhanced error recovery for smooth playback
        const onError = (event: any, data: any) => {
          console.error("[HlsPlayer] HLS Error:", data.type, data.details, data);
          if (data.response) {
            console.error("[HlsPlayer] Response details:", data.response);
          }

          // Auto-recover from common errors
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("[HlsPlayer] Network error, attempting recovery");
                // Check if this is a 404 error (manifest not found)
                if (data.response && data.response.code === 404) {
                  console.warn("[HlsPlayer] HLS manifest not found, falling back to original source");
                  // Fallback to original MP4 by setting src directly
                  try {
                    const originalSrc = src.replace(/^\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
                      const baseName = match.split('/')[3]; // Extract directory name
                      return `/videos/${decodeURIComponent(baseName)}.mp4`;
                    });
                    if (originalSrc !== src) {
                      console.log("[HlsPlayer] Falling back to MP4:", originalSrc);
                      video.src = originalSrc;
                      video.load();
                      return;
                    }
                  } catch (fallbackErr) {
                    console.error("[HlsPlayer] Fallback failed:", fallbackErr);
                  }
                }
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("[HlsPlayer] Media error, attempting recovery");
                hls.recoverMediaError();
                break;
              default:
                console.error("[HlsPlayer] Fatal error, destroying instance");
                hls.destroy();
                break;
            }
          }
        };
        const onLevelSwitched = (event: any, data: any) => {
          if (isDebug) console.debug("[HlsPlayer] level switched", data);
        };
        const onFragBuffered = (event: any, data: any) => {
          if (isDebug) console.debug("[HlsPlayer] frag buffered", data);
        };
        // Add buffer events for monitoring
        const onBufferAppended = (event: any, data: any) => {
          if (isDebug) console.debug("[HlsPlayer] buffer appended", data);
        };
        const onBufferEos = (event: any, data: any) => {
          if (isDebug) console.debug("[HlsPlayer] buffer EOS", data);
        };
  
        hls.on(Hls.Events.ERROR, onError);
        hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
        hls.on(Hls.Events.FRAG_BUFFERED, onFragBuffered);
        hls.on(Hls.Events.BUFFER_APPENDED, onBufferAppended);
        hls.on(Hls.Events.BUFFER_EOS, onBufferEos);
  
        // assign detach function for cleanup
        detachHlsListeners = () => {
          try {
            hls.off(Hls.Events.ERROR, onError);
            hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
            hls.off(Hls.Events.FRAG_BUFFERED, onFragBuffered);
            hls.off(Hls.Events.BUFFER_APPENDED, onBufferAppended);
            hls.off(Hls.Events.BUFFER_EOS, onBufferEos);
          } catch { /* no-op */ }
        };
      } catch (err) {
        // If dynamic import fails or initialization fails, fallback to direct src
        // eslint-disable-next-line no-console
        console.warn("[HlsPlayer] dynamic import or init failed, falling back to direct src", err);
        try {
          // ensure any previous HLS marker is removed
          try { video.removeAttribute("data-hls-managed"); } catch { /* no-op */ }
          video.src = src;
        } catch { /* no-op */ }
       }
    }
  
    void setupHls();
  
    return () => {
      cancelled = true;
      if (hlsRef.current) {
        try { detachHlsListeners?.(); } catch { /* no-op */ }
        try {
          const maybe = hlsRef.current;
          if (maybe && typeof maybe.destroy === "function") {
            maybe.destroy();
          }
        } catch { /* no-op */ }
        hlsRef.current = null;
      }
      try {
        const el = internalRef.current;
        if (el && typeof el.removeAttribute === "function") {
          el.removeAttribute("data-hls-managed");
        }
      } catch { /* no-op */ }
    };
  }, [src, ref]);
  
  // Expose the internal ref through forwarded ref
  const setRef = (el: HTMLVideoElement | null) => {
    internalRef.current = el;
    if (!ref) return;
    if (typeof ref === "function") {
      try { (ref as any)(el); } catch { /* no-op */ }
    } else {
      try { (ref as any).current = el; } catch { /* no-op */ }
    }
  };
  
  return (
    <video
      ref={setRef}
      // src is managed by hls.js or set in effect
      {...props}
    />
  );
});

export default HlsPlayer;

