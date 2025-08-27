import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type PlaylistItem = { name: string; url: string };

type DomControls = {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  applyState: (opts: { muted?: boolean; volume?: number }) => void;
};

type VideoContextValue = {
  playlist: PlaylistItem[];
  currentIndex: number;
  setIndex: (idx: number) => void;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  next: () => void;
  prev: () => void;
  registerDomControls: (controls: DomControls | null) => void;
};

const VideoContext = createContext<VideoContextValue | null>(null);

function encodePath(name: string) {
  // Encode each path segment safely
  return `/videos/${encodeURIComponent(name)}`;
}

function buildPlaylist(): PlaylistItem[] {
  const files = [
    "CNCO - Reggaetón Lento (Bailemos).mp4",
    "Caroline Polachek - Ocean of Tears.mp4",
    "Chloe x Halle - Do It .mp4",
    "FKA twigs - thank you song.mp4",
    "Fleetwood Mac - Landslide (Live).mp4",
    "Imogen Heap - Goodnight and Go.mp4",
    "Jimmy Eat World - Sweetness.mp4",
    "JoJo - Leave (Get Out).mp4",
    "JoJo - Too Little Too Late.mp4",
    "Julian Casablancas+The Voidz - Human Sadness.mp4",
    "LANA DEL REY - CARMEN.mp4",
    "LCD Soundsystem - american dream.mp4",
    "Mazzy Star - Fade Into You.mp4",
    "Michelle Branch - Everywhere.mp4",
    "Natasha Bedingfield - Unwritten.mp4",
    "Paris Hilton - Stars Are Blind.mp4",
    "Rina Sawayama - Hurricanes.mp4",
    "The Strokes - Automatic Stop Live Lollapalooza.mp4",
    "The Veronicas - Untouched.mp4",
    "Tinashe - Bouncin.mp4",
  ];
  return files.map((name) => ({ name, url: encodePath(name) }));
}

const LS_KEYS = {
  volume: "ep:bgVideoVolume",
  muted: "ep:bgVideoMuted",
  index: "ep:bgVideoIndex",
  time: "ep:bgVideoTime",
} as const;

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const playlist = useMemo(() => buildPlaylist(), []);
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.index);
      const n = raw ? Number(raw) : 0;
      if (Number.isFinite(n) && n >= 0 && n < playlist.length) return n;
      return 0;
    } catch {
      return 0;
    }
  });
  const [currentTime, setCurrentTimeState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.time);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  });
  const [muted, setMutedState] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.muted);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.volume);
      const n = raw ? Number(raw) : 0.5;
      if (!Number.isFinite(n)) return 0.5;
      return Math.min(1, Math.max(0, n));
    } catch {
      return 0.5;
    }
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const domControlsRef = useRef<DomControls | null>(null);

  const registerDomControls = useCallback((controls: DomControls | null) => {
    domControlsRef.current = controls;
    // When a new video element registers, ensure it reflects current state
    if (controls) {
      controls.applyState({ muted, volume });
      if (isPlaying) {
        controls.play();
      } else {
        controls.pause();
      }
      if (currentTime > 0) {
        controls.seek(currentTime);
      }
    }
  }, [currentTime, isPlaying, muted, volume]);

  const setIndex = useCallback((idx: number) => {
    const next = (idx + playlist.length) % playlist.length;
    setCurrentIndex(next);
    try { localStorage.setItem(LS_KEYS.index, String(next)); } catch { /* no-op */ }
    // When index changes, reset time to 0 for next track unless we explicitly restore
    setCurrentTimeState(0);
    try { localStorage.setItem(LS_KEYS.time, "0"); } catch { /* no-op */ }
  }, [playlist.length]);

  const setCurrentTime = useCallback((t: number) => {
    const clamped = Math.max(0, t || 0);
    setCurrentTimeState(clamped);
    try { localStorage.setItem(LS_KEYS.time, String(clamped)); } catch { /* no-op */ }
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    try { localStorage.setItem(LS_KEYS.muted, m ? "true" : "false"); } catch { /* no-op */ }
    domControlsRef.current?.applyState({ muted: m });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    try { localStorage.setItem(LS_KEYS.volume, String(clamped)); } catch { /* no-op */ }
    domControlsRef.current?.applyState({ volume: clamped });
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
    domControlsRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    domControlsRef.current?.pause();
  }, []);

  const next = useCallback(() => {
    setIndex(currentIndex + 1);
  }, [currentIndex, setIndex]);

  const prev = useCallback(() => {
    setIndex(currentIndex - 1);
  }, [currentIndex, setIndex]);

  const value: VideoContextValue = {
    playlist,
    currentIndex,
    setIndex,
    currentTime,
    setCurrentTime,
    isPlaying,
    play,
    pause,
    muted,
    setMuted,
    volume,
    setVolume,
    next,
    prev,
    registerDomControls,
  };

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used within a VideoProvider");
  return ctx;
}