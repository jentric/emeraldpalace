import React from "react";
import { useVideo } from "./VideoContext";

export default function VideoControls({ filename }: { filename: string }) {
  const { isPlaying, play, pause, muted, setMuted, volume, setVolume } = useVideo();

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