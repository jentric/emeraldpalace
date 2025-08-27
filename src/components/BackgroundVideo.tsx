import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVideo } from "./VideoContext";
import { useConvexAuth } from "convex/react";
import VideoControls from "./VideoControls";

function getSaveData(): boolean {
  try {
    // @ts-expect-error vendor-prefixed properties are not in the standard lib types
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(conn?.saveData);
  } catch {
    return false;
  }
}

export default function BackgroundVideo() {
  const {
    playlist,
    currentIndex,
    setIndex,
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

  const [ready, setReady] = useState(false);
  const [visibleOpacity, setVisibleOpacity] = useState(0);
  const [blocked, setBlocked] = useState(false); // NotAllowedError (autoplay) fallback UI

  const saveData = useMemo(getSaveData, []);
  const src = playlist[currentIndex]?.url ?? "";
  const filename = playlist[currentIndex]?.name ?? "";
  // Debug helper
  const dbg = (...args: any[]) => console.debug("[BGV]", ...args);

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
        if (typeof opts.muted === "boolean") videoRef.current.muted = opts.muted;
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
    // Bandwidth hint
    el.preload = saveData ? "metadata" : "auto";
    el.src = src;
    el.muted = muted;
    el.volume = volume;
    el.playsInline = true;

    dbg("init", { src, currentIndex, muted, volume });

    // Restore time after metadata loads
    const onLoadedMeta = () => {
      // Mark as ready so background becomes visible promptly
      setReady(true);
      // If we had previously persisted a time, restore it
      if (currentTime > 0 && Number.isFinite(currentTime)) {
        try { el.currentTime = currentTime; } catch { /* no-op */ }
      }
      dbg("loadedmetadata", { currentSrc: el.currentSrc, duration: el.duration });
    };
    const tryPlay = () => {
      // Only attempt programmatic play if muted or after user gesture.
      if (!muted && !userGestureRef.current) {
        dbg("tryPlay skipped (needs user gesture when unmuted)");
        return;
      }
      void el.play()
        .then(() => {
          setBlocked(false);
          dbg("play() success", { currentTime: el.currentTime, muted: el.muted, volume: el.volume });
        })
        .catch((err) => {
          // Detect autoplay prevention; sync UI back to paused so controls match reality
          if (err && (err.name === "NotAllowedError" || String(err).includes("NotAllowedError"))) {
            setBlocked(true);
            // If VideoContext thinks we're playing but the browser blocked, force a pause() to sync UI
            pause();
          }
          dbg("play() failed", { name: err?.name, message: err?.message, currentSrc: el.currentSrc });
        });
    };
    const onCanPlay = () => {
      setReady(true);
      dbg("canplay", { readyState: el.readyState });
      tryPlay();
    };
    const onCanPlayThrough = () => {
      setReady(true);
      dbg("canplaythrough", { readyState: el.readyState });
      tryPlay();
    };
    const onEnded = () => {
      dbg("ended, advancing", { from: currentIndex, to: currentIndex + 1 });
      setIndex(currentIndex + 1);
    };
    const onTimeUpdate = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setCurrentTime(el.currentTime || 0);
      });
    };
    const onError = () => {
      const mediaErr = el.error;
      dbg("error", { code: mediaErr?.code, message: mediaErr?.message, currentSrc: el.currentSrc });
      // keep ready as-is; error visibility is inspected via console
    };

    el.addEventListener("loadedmetadata", onLoadedMeta);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("canplaythrough", onCanPlayThrough);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("canplaythrough", onCanPlayThrough);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("error", onError);
    };
  }, [src, currentIndex, isPlaying, muted, volume, currentTime, setCurrentTime, setIndex, saveData]);
  
  // Preload the next video (metadata only) to hide loading between transitions
  useEffect(() => {
    const nextIndex = (currentIndex + 1 + playlist.length) % playlist.length;
    const nextUrl = playlist[nextIndex]?.url;
    const el = preloadRef.current;
    if (!el || !nextUrl) return;
    el.preload = saveData ? "none" : "metadata";
    el.src = nextUrl;
    el.load();
  }, [currentIndex, playlist, saveData]);
  
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
  }, [isAuthenticated, muted, saveData]);
  
  // Start playback on first user interaction (satisfies autoplay policies when unmuted or if previous attempts were blocked).
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => {
      userGestureRef.current = true;
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
        <video
          ref={videoRef}
          className="ep-bg-video-el"
          src={src}
          muted={muted}
          playsInline
          loop={false}
          autoPlay
          // preload is set via effect to respect Data Saver
          aria-hidden="true"
        />
      </div>

      {/* Hidden pre-loader for the next track */}
      <video ref={preloadRef} style={{ display: "none" }} aria-hidden="true" />

      {/* Controls (bottom-left via CSS) - show only when authenticated */}
      {isAuthenticated && <VideoControls filename={filename} />}

      {/* Autoplay blocked fallback (bottom-left next to controls) */}
      {isAuthenticated && blocked && (
        <div className="ep-bg-controls" role="region" aria-label="Enable background video">
          <button
            type="button"
            className="ep-bg-btn"
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
