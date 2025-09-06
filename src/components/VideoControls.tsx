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

  const [showOverflow, setShowOverflow] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  // Reflect playlist open state (announced by Playlist via 'ep:playlist-state')
  useEffect(() => {
    const onState = (ev: Event) => {
      try { setPlaylistOpen(Boolean((ev as CustomEvent<boolean>).detail)); } catch { /* ignore */ }
    };
    window.addEventListener("ep:playlist-state", onState as EventListener);
    return () => window.removeEventListener("ep:playlist-state", onState as EventListener);
  }, []);

  // Return true when a click/key event should NOT toggle the playlist (interactive controls)
  const shouldIgnoreToggle = (target?: EventTarget | null) => {
    let node = target as HTMLElement | null;
    while (node) {
      const tag = (node.tagName || "").toUpperCase();
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return true;
      try {
        if (node.hasAttribute && node.hasAttribute("data-no-toggle")) return true;
      } catch { /* ignore */ }
      node = node.parentElement;
    }
    return false;
  };

  const [showPlayerInfo, setShowPlayerInfo] = useState(false);

  return (
    <div
      className="ep-bg-controls"
      role="button"
      tabIndex={0}
      aria-label="Background video controls — toggle songs list"
      aria-expanded={playlistOpen}
      aria-controls="playlist-panel"
      style={{ maxWidth: "min(92vw, 980px)", flexWrap: "nowrap" }}
      onClick={(e) => {
        if (shouldIgnoreToggle(e.target)) return;
        try { window.dispatchEvent(new Event("ep:playlist-toggle")); } catch { /* ignore */ }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          try { window.dispatchEvent(new Event("ep:playlist-toggle")); } catch { /* ignore */ }
        }
      }}
    >
      <div className="ep-bg-filename relative flex items-center gap-2" aria-live="polite" title={`Now playing: ${filename}`}>
        <span className="sr-only">Current track: </span>
        {/* Desktop/large screens: keep marquee */}
        <span className="ep-bg-marquee pr-8 hidden md:inline-block" aria-hidden="true">{filename}&nbsp;&nbsp;&nbsp;</span>
        {/* Mobile: truncated title (no scrolling). Playlist toggle moved to the player-bar container for a single accessible toggle target. */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="truncate max-w-[52vw] text-sm" aria-hidden="true">{filename.replace(/\.mp4$/i, "")}</span>
        </div>

        {/* Player Info Button */}
        <button
          onClick={() => setShowPlayerInfo(!showPlayerInfo)}
          className="absolute right-0 top-1/2 -translate-y-1/2 info-button"
          aria-label="Information about the music playlist"
          title="Learn about Em's music collection"
        >
          ℹ
        </button>

        {/* Player Info Tooltip */}
        {showPlayerInfo && (
          <div className="info-tooltip absolute top-full left-0 mt-2 max-w-sm z-50">
            <div className="font-semibold mb-1">🎵 Em's Favorite Songs</div>
            <p className="mb-2">These are some of Em's most cherished songs that have special meaning. Each track tells a story and captures a moment in time.</p>
            <p className="text-xs opacity-90">💡 <strong>Want to add more?</strong> Use the "Suggest More" button in the playlist to submit your favorite songs!</p>
            <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="ep-bg-btn ep-btn group"
        aria-label={isPlaying ? "Pause background video playback" : "Resume background video playback"}
        aria-pressed={isPlaying}
        onClick={togglePlay}
        title={isPlaying ? "Click to pause video" : "Click to play video"}
      >
        <span className="text-lg transition-transform group-hover:scale-110" aria-hidden="true">
          {isPlaying ? "❚❚" : "▶"}
        </span>
        <span className="sr-only">{isPlaying ? "Pause" : "Play"} background video</span>
      </button>

      <button
        type="button"
        className="ep-bg-btn ep-btn group"
        aria-label="Skip to previous track in playlist"
        onClick={prev}
        disabled={playlist.length <= 1}
        title={playlist.length <= 1 ? "Only one track available" : "Go to previous track"}
      >
        <span className="text-lg transition-transform group-hover:scale-110" aria-hidden="true">⏮</span>
        <span className="sr-only">Previous track</span>
      </button>

      <button
        type="button"
        className="ep-bg-btn ep-btn group"
        aria-label="Skip to next track in playlist"
        onClick={next}
        disabled={playlist.length <= 1}
        title={playlist.length <= 1 ? "Only one track available" : "Go to next track"}
      >
        <span className="text-lg transition-transform group-hover:scale-110" aria-hidden="true">⏭</span>
        <span className="sr-only">Next track</span>
      </button>

      <button
        type="button"
        className="ep-bg-btn group"
        aria-label={muted ? "Enable background video audio" : "Disable background video audio"}
        aria-pressed={muted}
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (!next) {
            // If unmuting, ensure audible volume and start playback
            if (volume === 0) setVolume(0.5);
            if (!isPlaying) play();
          }
        }}
        title={muted ? "Click to unmute audio" : "Click to mute audio"}
      >
        <span className="text-lg transition-transform group-hover:scale-110" aria-hidden="true">
          {muted ? "🔇" : "🔊"}
        </span>
        <span className="sr-only">{muted ? "Unmute" : "Mute"} background video</span>
      </button>

      {/* Low effects mode toggle for performance */}
      <button
        type="button"
        className="ep-bg-btn ep-btn group"
        aria-label={lowfx ? "Disable performance mode (higher quality visuals)" : "Enable performance mode (reduced visual effects)"}
        aria-pressed={lowfx}
        title={lowfx ? "Performance mode: ON - Click to enable full visual effects" : "Performance mode: OFF - Click to reduce visual effects for better performance"}
        onClick={() => {
          const next = !lowfx;
          try {
            document.dispatchEvent(new CustomEvent("ep:lowfx-toggle", { detail: next }));
          } catch { /* no-op */ }
          setLowfx(next);
        }}
      >
        <span className="text-sm font-medium transition-transform group-hover:scale-110" aria-hidden="true">
          {lowfx ? "FX-" : "FX"}
        </span>
        <span className="sr-only">{lowfx ? "Disable" : "Enable"} performance mode</span>
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor="bg-volume-slider" className="sr-only">Background video volume control</label>
        <input
          id="bg-volume-slider"
          className="ep-bg-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          aria-label={`Background video volume: ${Math.round(volume * 100)}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          aria-valuetext={`${Math.round(volume * 100)} percent volume`}
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
        <span className="text-xs opacity-70 sr-only" aria-live="polite">
          Volume: {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Overflow menu (mobile/compact) */}
      <div className="relative md:hidden">
        <button type="button" className="ep-bg-btn ep-btn" aria-haspopup="menu" aria-expanded={showOverflow} aria-label="More controls" onClick={() => setShowOverflow(v => !v)}>
          •••
        </button>
        {showOverflow && (
          <div role="menu" className="absolute right-0 bottom-full mb-2 bg-white/90 border border-black rounded-xl p-2 shadow-xl flex flex-col min-w-[140px] z-10">
            <button role="menuitem" className="ep-btn ep-btn--pink mb-2" onClick={() => { setShowOverflow(false); try { document.dispatchEvent(new Event("ep:lowfx-toggle")); } catch (e) { /* ignore */ } }}>
               Toggle FX
             </button>
            {/* Removed duplicate "Songs" menu item — playlist toggle is provided on the player bar container */}
          </div>
        )}
      </div>

      {/* Screen reader status updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Background video: {isPlaying ? "playing" : "paused"}, volume {Math.round(volume * 100)}%, {muted ? "muted" : "unmuted"}
      </div>
    </div>
  );
}