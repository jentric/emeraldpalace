import React, { useEffect, useState } from "react";
import { useVideo } from "./VideoContext";

export default function VideoControls({ filename }: { filename: string }) {
  const { isPlaying, play, pause, muted, setMuted, volume, setVolume, next, prev, currentIndex, playlist } = useVideo();

  // Track low-effects mode from <html class="ep-lowfx"> and stay in sync
  const [lowfx, setLowfx] = useState<boolean>(() => {
    try { return document.documentElement.classList.contains("ep-lowfx"); } catch { return false; }
  });
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      try { setLowfx(root.classList.contains("ep-lowfx")); } catch { /* no-op */ }
    };
    update();
    const observer = new MutationObserver(update);
    try { observer.observe(root, { attributes: true, attributeFilter: ["class"] }); } catch { /* no-op */ }
    const onToggle = (ev: Event) => {
      try { setLowfx(Boolean((ev as CustomEvent<boolean>).detail)); } catch { /* no-op */ }
    };
    document.addEventListener("ep:lowfx-toggle", onToggle as EventListener);
    return () => {
      observer.disconnect();
      document.removeEventListener("ep:lowfx-toggle", onToggle as EventListener);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  return (
    <div className="ep-bg-controls" role="region" aria-label="Background video controls">
      <div className="ep-bg-filename" aria-live="polite" title={filename}>
        <span className="ep-bg-marquee">{filename}&nbsp;&nbsp;&nbsp;</span>
      </div>

      <button
        type="button"
        className="ep-bg-btn"
        aria-label={isPlaying ? "Pause background video" : "Play background video"}
        onClick={togglePlay}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <button
        type="button"
        className="ep-bg-btn"
        aria-label="Previous track"
        onClick={prev}
        disabled={playlist.length <= 1}
        title="Previous track"
      >
        ⏮
      </button>

      <button
        type="button"
        className="ep-bg-btn"
        aria-label="Next track"
        onClick={next}
        disabled={playlist.length <= 1}
        title="Next track"
      >
        ⏭
      </button>

      <button
        type="button"
        className="ep-bg-btn"
        aria-label={muted ? "Unmute background video" : "Mute background video"}
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (!next) {
            // If unmuting, ensure audible volume and start playback
            if (volume === 0) setVolume(0.5);
            if (!isPlaying) play();
          }
        }}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* Low effects mode toggle for performance */}
      <button
        type="button"
        className="ep-bg-btn"
        aria-label={lowfx ? "Disable low effects mode" : "Enable low effects mode"}
        title={lowfx ? "Low FX: On" : "Low FX: Off"}
        onClick={() => {
          const next = !lowfx;
          try {
            document.dispatchEvent(new CustomEvent("ep:lowfx-toggle", { detail: next }));
          } catch { /* no-op */ }
          setLowfx(next);
        }}
      >
        {lowfx ? "FX-" : "FX"}
      </button>

      <input
        className="ep-bg-volume"
        type="range"
        min={0}
        max={1}
        step={0.01}
        aria-label="Background video volume"
        value={volume}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const v = parseFloat(e.target.value);
          setVolume(v);
          if (v > 0) {
            if (muted) setMuted(false);
            if (!isPlaying) play();
          } else {
            if (!muted) setMuted(true);
          }
        }}
      />
    </div>
  );
}