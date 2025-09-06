import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useVideo } from "./VideoContext";
import { useConvexAuth } from "convex/react";
import VideoControls from "./VideoControls";
import Playlist from "./Playlist";
import HlsPlayer from "./HlsPlayer";

function getSaveData(): boolean {
  try {
    // @ts-expect-error vendor-prefixed properties are not in the standard lib types
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(conn?.saveData);
  } catch {
    return false;
  }
}

// Keep only one background video playing at once across instances
let activeBgVideo: HTMLVideoElement | null = null;

export default function BackgroundVideo() {
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const preloadRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // Track whether the user has interacted (to satisfy autoplay policies when unmuted)
  const userGestureRef = useRef<boolean>(false);
  // Track the desired mute state from app/UI; only unmute after a user gesture
  const desiredMutedRef = useRef<boolean>(true);
  // React-visible user activation to control initial muted prop
  const [activated, setActivated] = useState(false);

  // Fallback attempt tracking for variant URLs
  const candidateIndexRef = useRef<number>(0);
  const candidatesRef = useRef<string[]>([]);
  const resolvedRef = useRef<boolean>(false);

  // Low-effects application state
  const lowFxAppliedRef = useRef<boolean>(false);

  // Throttle sending currentTime into global state to limit re-renders
  const lastSentTimeRef = useRef<number>(0);

  const [ready, setReady] = useState(false);
  const [visibleOpacity, setVisibleOpacity] = useState(0);
  const [blocked, setBlocked] = useState(false); // NotAllowedError (autoplay) fallback UI
  const [_isBuffering, setIsBuffering] = useState(false);

  const saveData = useMemo(getSaveData, []);
  const src = playlist[currentIndex]?.url ?? "";
  const filename = playlist[currentIndex]?.name ?? "";

  // Debug helper
  const dbg = (...args: any[]) => console.debug("[BGV]", ...args);

  // Helper to check if HLS manifest exists (currently unused but available for future use)
  const _checkHlsManifest = async (hlsUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(hlsUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Apply/remove low-effects mode
  const applyLowFx = useCallback((on: boolean) => {
    if (on && !lowFxAppliedRef.current) {
      document.documentElement.classList.add("ep-lowfx");
      lowFxAppliedRef.current = true;
      try { sessionStorage.setItem("ep:lowfx", "1"); } catch { /* no-op */ }
      dbg("lowfx: enabled");
    } else if (!on && lowFxAppliedRef.current) {
      document.documentElement.classList.remove("ep-lowfx");
      lowFxAppliedRef.current = false;
      try { sessionStorage.removeItem("ep:lowfx"); } catch { /* no-op */ }
      dbg("lowfx: disabled");
    }
  }, []);

  // Initialize lowfx from Data Saver or persisted preference; clean up on unmount
  useEffect(() => {
    let initial = false;
    try { initial = !!sessionStorage.getItem("ep:lowfx"); } catch { /* no-op */ }
    if (saveData) initial = true; // honor OS/browser data saver
    applyLowFx(initial);
    return () => applyLowFx(false);
  }, [saveData, applyLowFx]);

  // Adaptive detection: if frame pacing is choppy, enable lowfx
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;

    // Prefer requestVideoFrameCallback when available
    const rvfc: any = (el as any).requestVideoFrameCallback;
    const cancelRvfc: any = (el as any).cancelVideoFrameCallback;

    if (typeof rvfc === "function") {
      let handle: number | null = null;
      let lastTs: number | undefined;
      let spikes = 0;
      let samples = 0;
      const sampleSize = 120; // ~2s at 60fps
      const spikeThresholdMs = 55; // consider frame gap > ~3 frames at 60fps

      const step = (now: number) => {
        if (cancelled) return;
        if (lastTs !== undefined) {
          const delta = now - lastTs;
          if (delta > spikeThresholdMs) spikes++;
        }
        lastTs = now;
        samples++;

        if (samples >= sampleSize) {
          const ratio = spikes / samples;
          dbg("lowfx sample", { spikes, samples, ratio });
          if (ratio > 0.15) applyLowFx(true); // enable if >=15% spikes in window
          // Do not auto-disable to avoid flicker; user can refresh to re-evaluate
          spikes = 0;
          samples = 0;
        }

        handle = rvfc.call(el, step);
      };

      handle = rvfc.call(el, step);
      return () => {
        cancelled = true;
        if (handle && typeof cancelRvfc === "function") {
          try { cancelRvfc.call(el, handle); } catch { /* no-op */ }
        }
      };
    }

    // Fallback: poll playback quality where supported
    const interval = window.setInterval(() => {
      try {
        const q = (el as any).getVideoPlaybackQuality?.();
        if (q && q.totalVideoFrames > 0) {
          const ratio = q.droppedVideoFrames / q.totalVideoFrames;
          dbg("lowfx quality", { dropped: q.droppedVideoFrames, total: q.totalVideoFrames, ratio: ratio.toFixed(3) });
          if (ratio > 0.1) applyLowFx(true);
        } else {
          const dropped = (el as any).webkitDroppedFrameCount ?? 0;
          const decoded = (el as any).webkitDecodedFrameCount ?? 0;
          if (decoded > 0) {
            const ratio = dropped / decoded;
            dbg("lowfx quality (webkit)", { dropped, decoded, ratio: ratio.toFixed(3) });
            if (ratio > 0.1) applyLowFx(true);
          }
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => { window.clearInterval(interval); };
  }, [src, applyLowFx]);

  // Build candidate URL variants to handle Unicode normalization + encoding differences
  function buildUrlCandidates(name: string, primarySrc: string): string[] {
    const forms = new Set<string>();
    const normed = [name, name.normalize?.("NFC"), name.normalize?.("NFD"), name.normalize?.("NFKC"), name.normalize?.("NFKD")]
      .filter((s): s is string => typeof s === "string");
    const encoders = [
      (s: string) => encodeURIComponent(s),
      (s: string) => encodeURI(s),
      (s: string) => s, // raw
    ];
    // Always try current playlist-provided src first
    forms.add(primarySrc);
    for (const n of normed) {
      for (const enc of encoders) {
        const seg = enc(n);
        forms.add(`/videos/${seg}`);
      }
    }
    return Array.from(forms);
  }

  // Register DOM controls to the context so external controls (and persisted state) apply to the element.
  useEffect(() => {
    const controls = {
      play: () => {
        const el = videoRef.current;
        if (!el) return;
        // For direct UI actions, always attempt play(); browser will allow if user-initiated.
        void el.play().catch(() => { /* ignore autoplay failures here; autoplay checks handled elsewhere */ });
      },
      pause: () => { videoRef.current?.pause(); },
      seek: (t: number) => {
        if (videoRef.current) {
          try { videoRef.current.currentTime = Math.max(0, t || 0); } catch { /* no-op */ }
        }
      },
      applyState: (opts: { muted?: boolean; volume?: number }) => {
        if (!videoRef.current) return;
        if (typeof opts.muted === "boolean") {
          // Record desired mute state from UI; only unmute if user has interacted
          desiredMutedRef.current = opts.muted;
          if (opts.muted) {
            videoRef.current.muted = true;
          } else if (userGestureRef.current) {
            videoRef.current.muted = false;
          }
        }
        if (typeof opts.volume === "number") videoRef.current.volume = Math.min(1, Math.max(0, opts.volume));
      },
    };
    registerDomControls(controls);
    return () => registerDomControls(null);
  }, [registerDomControls]);

  // Setup/refresh the primary video element when src/index changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    setReady(false);
    resolvedRef.current = false;
    // Build fallback candidates and reset attempt index
    const candidates = buildUrlCandidates(filename, src);
    candidatesRef.current = candidates;
    candidateIndexRef.current = 0;

    // Bandwidth hint
    // el.preload = saveData ? "metadata" : "auto";
    // Use first candidate; others attempted on error
    // el.src = candidatesRef.current[candidateIndexRef.current];
    // Baseline attributes for best autoplay behavior
    // el.autoplay = true;
    // el.playsInline = true;
    // iOS Safari hint; cast to any to avoid typing issues
    // (el as any).webkitPlaysInline = true;
    // Start muted to satisfy autoplay; we still honor user preference after gesture
    // el.muted = true;

    // Keep previous state alignment
    el.volume = volume;

    dbg("init", { requestedName: filename, primarySrc: src, firstAttempt: el.src, totalCandidates: candidatesRef.current.length });

    const ensureSingleActive = (v: HTMLVideoElement) => {
      if (activeBgVideo && activeBgVideo !== v && !activeBgVideo.paused) {
        try { activeBgVideo.pause(); } catch { /* no-op */ }
      }
      activeBgVideo = v;
    };

    const _setNextCandidate = () => {
      if (resolvedRef.current) return;
      const next = candidateIndexRef.current + 1;
      if (next < candidatesRef.current.length) {
        candidateIndexRef.current = next;
        const nextUrl = candidatesRef.current[next];
        try {
          el.src = nextUrl;
          // Force a load to ensure new request
          el.load();
        } catch { /* no-op */ }
        dbg("retry with candidate", { attempt: next + 1, url: nextUrl });
      } else {
        dbg("exhausted candidates; no playable source found", { attempts: candidatesRef.current.length, lastError: el.error?.code });
        try { setIndex(currentIndex + 1); } catch { /* no-op */ }
      }
    };

    // Try programmatic play with muted-first fallback for autoplay policy
    const tryPlay = async (v: HTMLVideoElement) => {
      ensureSingleActive(v);
      try {
        await v.play();
        setBlocked(false);
        resolvedRef.current = true;
        dbg("play() success", { currentTime: v.currentTime, muted: v.muted, volume: v.volume, src: v.currentSrc });
      } catch (err: any) {
        dbg("play() failed", { name: err?.name, message: err?.message });
        if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) {
          // Fallback: force muted and retry to satisfy autoplay
          v.muted = true;
          try {
            await v.play();
            setBlocked(false);
            resolvedRef.current = true;
            dbg("retry play() muted success", { src: v.currentSrc });
          } catch (err2: any) {
            dbg("retry play() muted failed", { name: err2?.name, message: err2?.message });
          }
        }
      }
    };

    // Restore time after metadata loads and attempt to play
    const onLoadedMeta = () => {
      setReady(true);
      setIsBuffering(false);
      dbg("loadedmetadata", { currentSrc: el.currentSrc, duration: el.duration });
      if (Number.isFinite(currentTime) && currentTime > 0) {
        let t = Math.max(0, currentTime);
        const dur = el.duration;
        if (Number.isFinite(dur)) {
          const margin = 1.0;
          if (t >= dur - margin) t = 0;
        }
        try { el.currentTime = t; } catch { /* no-op */ }
        dbg("restore time", { requested: currentTime, applied: el.currentTime, duration: el.duration });
      }
      void tryPlay(el);
    };

    const onCanPlay = () => {
      setIsBuffering(false);
      setReady(true);
      resolvedRef.current = true;
      dbg("canplay", { readyState: el.readyState, src: el.src });
      void tryPlay(el);
    };

    const onCanPlayThrough = () => {
      setIsBuffering(false);
      setReady(true);
      resolvedRef.current = true;
      dbg("canplaythrough", { readyState: el.readyState, src: el.src });
      void tryPlay(el);
    };

    const onPlay = () => {
      ensureSingleActive(el);
    };
    const _onWaiting = () => {
      // Fired when playback has stopped because the next frame is not available
      try { setIsBuffering(true); } catch { /* no-op */ }
      dbg("waiting (buffering)", { src: el.currentSrc });
    };
    const _onPlaying = () => {
      try { setIsBuffering(false); } catch { /* no-op */ }
      dbg("playing", { src: el.currentSrc });
    };

    const onEnded = () => {
      dbg("ended, advancing (next)", { from: currentIndex });
      try { next(); } catch { /* no-op */ }
    };

    const onTimeUpdate = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const now = performance.now();
        if (now - lastSentTimeRef.current >= 500) {
          setCurrentTime(el.currentTime || 0);
          lastSentTimeRef.current = now;
        }
      });
    };

    const onError = () => {
      const mediaErr = el.error;
      dbg("error", { code: mediaErr?.code, message: mediaErr?.message, currentSrc: el.currentSrc, attempt: candidateIndexRef.current + 1 });
      // Let HlsPlayer/hls.js handle recovery; do not override src here.
    };

    el.addEventListener("loadedmetadata", onLoadedMeta);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("canplaythrough", onCanPlayThrough);
    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("error", onError);

    // One-time real user gesture unblocks unmuted playback
    const onFirstGesture = () => {
      userGestureRef.current = true;
      setActivated(true);
      // If already playing muted, unmute smoothly and ensure playing
      if (!desiredMutedRef.current) {
        el.muted = false;
      }
      void tryPlay(el);
    };
    document.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true, capture: true });
    document.addEventListener("keydown", onFirstGesture, { once: true, capture: true });
    
    // No longer do a synthetic play gesture to maintain policy adherence.
    
    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("canplaythrough", onCanPlayThrough);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("error", onError);
      document.removeEventListener("pointerdown", onFirstGesture, true);
      document.removeEventListener("keydown", onFirstGesture, true);
    };
  }, [src, filename, currentIndex, setCurrentTime, setIndex, saveData, volume, next, applyLowFx, currentTime]);

  // Page visibility optimization: pause decoding when tab is hidden, resume on visible
  useEffect(() => {
    const handle = () => {
      const el = videoRef.current;
      if (!el) return;
      if (document.hidden) {
        try { el.pause(); } catch { /* no-op */ }
      } else if (isPlaying) {
        void el.play().catch(() => { /* ignore */ });
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [isPlaying, pause]);
  
  // Preload the next video (metadata only) to hide loading between transitions
  useEffect(() => {
    const nextIndex = (currentIndex + 1 + playlist.length) % playlist.length;
    const nextUrl = playlist[nextIndex]?.url;
    const el = preloadRef.current;
    if (!el || !nextUrl) return;
    el.preload = saveData ? "none" : "metadata";

    // Skip preloading HLS manifests on browsers without native HLS (e.g., Chrome)
    // to avoid blob/errors; Hls.js will manage loading when needed.
    const isM3U8 = typeof nextUrl === "string" && nextUrl.toLowerCase().endsWith(".m3u8");
    const nativeHls = !!(el.canPlayType && el.canPlayType("application/vnd.apple.mpegurl"));
    if (isM3U8 && !nativeHls) return;

    try {
      el.src = nextUrl;
      el.load();
    } catch {
      // ignore preload errors
    }
  }, [currentIndex, playlist, saveData]);
   // Allow external UI to toggle low-effects mode via a custom event
  useEffect(() => {
    const onToggle = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent<boolean>).detail;
        applyLowFx(Boolean(detail));
      } catch {
        // ignore
      }
    };
    document.addEventListener("ep:lowfx-toggle", onToggle as EventListener);
    return () => {
      document.removeEventListener("ep:lowfx-toggle", onToggle as EventListener);
    };
  }, [applyLowFx]);
  
  // Eagerly load when signed in: increase preload and try muted playback to warm caches.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isAuthenticated) {
      el.preload = saveData ? "metadata" : "auto";
      // Ensure the browser evaluates preload change
      try { el.load(); } catch { /* no-op */ }
      // Attempt muted play to warm up decoding/buffers; do not flip global isPlaying.
      if (muted) {
        void el.play()
          .then(() => setBlocked(false))
          .catch((err) => {
            if (err && (err.name === "NotAllowedError" || String(err).includes("NotAllowedError"))) {
              setBlocked(true);
              pause();
            }
          });
      }
    }
  }, [isAuthenticated, muted, saveData, pause, applyLowFx]);
  
  // Start playback on first user interaction (satisfies autoplay policies when unmuted or if previous attempts were blocked).
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => {
      userGestureRef.current = true;
      setActivated(true);
      // Respect previously requested unmute after user activation
      const el = videoRef.current;
      if (el && !desiredMutedRef.current) {
        el.muted = false;
      }
      if (!isPlaying) {
        // User gesture present; safe to start regardless of mute state.
        play();
        setBlocked(false);
      }
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [isAuthenticated, isPlaying, play]);

  // Make sure we start playing muted in background during sign-in for warm-up
  useEffect(() => {
    if (saveData) return; // respect data saver
    // Warm-up only during sign-in (pre-auth). Do not force playback after auth.
    if (!isAuthenticated && !isPlaying && muted) {
      play();
    }
  }, [isAuthenticated, isPlaying, play, saveData, muted]);

  // Fade in as soon as the first video is ready (not gated by auth)
  useEffect(() => {
    const target = ready ? 0.35 : 0;
    const id = requestAnimationFrame(() => setVisibleOpacity(target));
    dbg("ready->opacity", { ready, opacity: target, src });
    return () => cancelAnimationFrame(id);
  }, [ready, src]);

  return (
    <>
      {/* Background video layer: fixed, behind all content; clicks pass through */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: visibleOpacity }}>
        <HlsPlayer
          key={src}
          ref={videoRef}
          className="ep-bg-video-el"
          src={src}
          muted={activated ? muted : true}
          playsInline
          loop={false}
          autoPlay
          aria-hidden="true"
          preload={saveData ? "metadata" : "auto"}
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
        />
        {/* Performance enhancement: 4px blur overlay */}
        <div className="ep-bg-video-blur" />
      </div>

      {/* Hidden pre-loader for the next track with enhanced buffering */}
      <video
        ref={preloadRef}
        style={{ display: "none" }}
        aria-hidden="true"
        preload="metadata"
        muted
      />

      {/* Controls (bottom-left via CSS) - show only when authenticated */}
      {isAuthenticated && <VideoControls filename={filename} />}

      {/* Playlist (bottom-left via CSS) - show only when authenticated */}
      {isAuthenticated && <Playlist />}

      {/* Autoplay blocked fallback (bottom-left next to controls) */}
      {isAuthenticated && blocked && (
        <div className="ep-bg-controls" role="region" aria-label="Enable background video">
          <button
            type="button"
            className="ep-bg-btn glassmorphic-btn"
            onClick={() => {
              userGestureRef.current = true;
              setBlocked(false);
              const el = videoRef.current;
              if (el) { void el.play().catch(() => { /* ignore */ }); }
            }}
          >
            Enable background video
          </button>
        </div>
      )}
    </>
  );
}
