import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from "react";
import { videoCache } from "./VideoCache";

// Utility function to parse artist and song from filename
const parseArtistAndSong = (filename: string) => {
  // Remove file extension if present
  const cleanName = filename.replace(/\.[^/.]+$/, '');

  // Split on " - " to separate artist from song
  const parts = cleanName.split(' - ');

  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const song = parts.slice(1).join(' - ').trim(); // Handle cases with multiple " - " in song title
    return { artist, song };
  }

  // Fallback: if no separator found, treat whole thing as song title
  return { artist: 'Unknown Artist', song: cleanName };
};

export interface PlaylistItem {
  name: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  artist?: string;
  song?: string;
}

export interface DomControls {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  applyState: (opts: { muted?: boolean; volume?: number }) => void;
}

export interface VideoContextValue {
  // Playlist management
  playlist: PlaylistItem[];
  currentIndex: number;
  setIndex: (index: number) => void;

  // Playback state
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;

  // Audio controls
  muted: boolean;
  setMuted: (muted: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;

  // Navigation
  next: () => void;
  prev: () => void;

  // Controls registration
  registerDomControls: (controls: DomControls | null) => void;

  // Cache management
  preloadNext: () => void;
  clearCache: () => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

function encodePath(name: string) {
  // Encode each path segment safely
  return `/videos/${encodeURIComponent(name)}`;
}

function buildPlaylist(): PlaylistItem[] {
  const files = [
    "CNCO - Reggaetón Lento (Bailemos)",
    "Caroline Polachek - Ocean of Tears",
    "Chloe x Halle - Do It",
    "FKA twigs - thank you song",
    "Fleetwood Mac - Landslide (Live)",
    "Imogen Heap - Goodnight and Go",
    "Jimmy Eat World - Sweetness",
    "JoJo - Leave (Get Out)",
    "JoJo - Too Little Too Late",
    "Julian Casablancas+The Voidz - Human Sadness",
    "LANA DEL REY - CARMEN",
    "LCD Soundsystem - american dream",
    "Mazzy Star - Fade Into You",
    "Michelle Branch - Everywhere",
    "Natasha Bedingfield - Unwritten",
    "Paris Hilton - Stars Are Blind",
    "Rina Sawayama - Hurricanes",
    "The Strokes - Automatic Stop Live Lollapalooza",
    "The Veronicas - Untouched",
    "Tinashe - Bouncin",
  ];
  return files.map((name) => {
    const { artist, song } = parseArtistAndSong(name);
    return {
      name: `${name}.mp4`,
      url: encodePath(`${name}.mp4`),
      artist,
      song
    };
  });
}

const LS_KEYS = {
  volume: "ep:bgVideoVolume",
  muted: "ep:bgVideoMuted",
  index: "ep:bgVideoIndex",
  time: "ep:bgVideoTime",
} as const;

export function VideoProvider({ children }: { children: React.ReactNode }) {
  // Start with the legacy MP4-based playlist, then prefer any generated HLS manifests if present.
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(() => buildPlaylist());
  // Maintain a persistent shuffled order of indices to avoid repetition and ensure a looping random experience.
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPos, setOrderPos] = useState<number>(0);

  // Probe for HLS manifests and prefer them when available. Build the HLS URL from the already
  // encoded MP4 URL to avoid any Unicode normalization/encoding mismatches.
  useEffect(() => {
    let mounted = true;
    // Intentionally ignore the returned promise (lint: use void)
    void (async () => {
      try {
        const checks = await Promise.all(playlist.map(async (p) => {
          // Decode the original filename to match the actual HLS directory names
          const decodedName = decodeURIComponent(p.name);
          const baseName = decodedName.replace(/\.mp4$/, ""); // Remove .mp4 extension for HLS path
          const hlsUrl = `/videos/hls/${encodeURIComponent(baseName)}/index.m3u8`;
          try {
            const res = await fetch(hlsUrl, { method: "HEAD" });
            if (res.ok) return { ...p, url: hlsUrl };
          } catch { /* network or not found */ }
          return p;
        }));
        if (mounted) setPlaylist(checks);
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, []); // Only run once on mount - intentionally omit playlist dependency to prevent infinite loop (ESLint warning expected)

  // Clear video cache
  const clearCache = useCallback(() => {
    videoCache.clear();
  }, []);
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.index);
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0 && n < playlist.length) return n;
      }
      // No saved index: start at a random track, then continue in order (looping)
      return playlist.length > 0 ? Math.floor(Math.random() * playlist.length) : 0;
    } catch {
      return playlist.length > 0 ? Math.floor(Math.random() * playlist.length) : 0;
    }
  });
  const [currentTime, setCurrentTimeState] = useState<number>(() => {
    try {
      // If no saved index, start at time 0 (random start handled above)
      const rawIndex = localStorage.getItem(LS_KEYS.index);
      if (rawIndex === null) return 0;
      const rawTime = localStorage.getItem(LS_KEYS.time);
      const n = rawTime ? Number(rawTime) : 0;
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

  // Utility to create a new shuffled order starting from a specific index (first),
  // followed by the remaining indices in random order. Ensures no immediate repeats.
  const makeOrder = useCallback((len: number, start: number): number[] => {
    const pool: number[] = [];
    for (let i = 0; i < len; i++) if (i !== start) pool.push(i);
    // Fisher–Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return [start, ...pool];
  }, []);

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
    // Re-anchor shuffled order to the chosen index so subsequent navigation follows
    // a randomized sequence from here without repeating immediately.
    setPlayOrder(makeOrder(playlist.length, next));
    setOrderPos(0);
  }, [playlist.length, makeOrder]);

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
    if (playlist.length === 0) return;
    if (playOrder.length !== playlist.length) {
      // Initialize or repair play order
      const order = makeOrder(playlist.length, currentIndex % Math.max(1, playlist.length));
      setPlayOrder(order);
      setOrderPos(0);
      setCurrentIndex(order[0]);
      try { localStorage.setItem(LS_KEYS.index, String(order[0])); } catch { /* no-op */ }
      return;
    }
    const nextPos = (orderPos + 1);
    if (nextPos < playOrder.length) {
      const idx = playOrder[nextPos];
      setOrderPos(nextPos);
      setIndex(idx); // setIndex also re-anchors order starting at idx
      return;
    }
    // Completed a cycle: reshuffle excluding immediate repeat
    const current = playOrder[playOrder.length - 1];
    let order = makeOrder(playlist.length, current);
    // Rotate so we move to the first element after current
    order = [order[0], ...order.slice(1)];
    // Choose the next start as the first different element, then rebuild order from there
    const nextStart = order[1 % order.length] ?? current;
    const reshuffled = makeOrder(playlist.length, nextStart);
    setPlayOrder(reshuffled);
    setOrderPos(0);
    setIndex(nextStart);
  }, [playlist.length, playOrder, orderPos, currentIndex, makeOrder, setIndex]);

  const prev = useCallback(() => {
    if (playlist.length === 0) return;
    if (orderPos > 0 && playOrder.length === playlist.length) {
      const idx = playOrder[orderPos - 1];
      setOrderPos(orderPos - 1);
      setIndex(idx);
    } else {
      setIndex(currentIndex - 1);
    }
  }, [playlist.length, orderPos, playOrder, currentIndex, setIndex]);

  // Preload next video for smoother transitions
  const preloadNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextUrl = playlist[nextIndex]?.url;
    if (nextUrl) {
      void videoCache.preload(nextUrl, 'low');
    }
  }, [currentIndex, playlist]);

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
    preloadNext,
    clearCache,
  };

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used within a VideoProvider");
  return ctx;
}