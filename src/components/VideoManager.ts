export interface VideoConfig {
  src: string;
  muted: boolean;
  volume: number;
  autoplay: boolean;
  loop: boolean;
  preload: 'none' | 'metadata' | 'auto';
}

export interface VideoState {
  isPlaying: boolean;
  isBuffering: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  error: Error | null;
}

export interface VideoEvents {
  ready: () => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  error: (error: Error) => void;
  buffering: (isBuffering: boolean) => void;
  timeupdate: (currentTime: number) => void;
  volumechange: (volume: number, muted: boolean) => void;
}

export class VideoManager extends EventTarget {
  private video: HTMLVideoElement | null = null;
  private hls: any = null;
  private state: VideoState = {
    isPlaying: false,
    isBuffering: false,
    isReady: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    error: null,
  };

  private eventListeners = new Map<string, EventListener>();

  constructor(videoElement: HTMLVideoElement) {
    super();
    this.video = videoElement;
    this.setupVideoElement();
    this.bindEvents();
  }

  private setupVideoElement(): void {
    if (!this.video) return;

    // Set optimized attributes
    this.video.preload = 'metadata';
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');

    // Disable unnecessary features for background video
    this.video.disablePictureInPicture = true;
    this.video.disableRemotePlayback = true;

    // Performance optimizations
    this.video.style.willChange = 'transform';
    this.video.style.backfaceVisibility = 'hidden';
    this.video.style.transform = 'translate3d(0, 0, 0)';
  }

  private bindEvents(): void {
    if (!this.video) return;

    const events = {
      loadstart: () => this.updateState({ isBuffering: true }),
      loadedmetadata: () => this.updateState({ isReady: true, duration: this.video?.duration || 0 }),
      loadeddata: () => this.updateState({ isBuffering: false }),
      canplay: () => this.updateState({ isBuffering: false }),
      canplaythrough: () => this.updateState({ isBuffering: false }),
      play: () => this.updateState({ isPlaying: true }),
      pause: () => this.updateState({ isPlaying: false }),
      ended: () => this.updateState({ isPlaying: false }),
      waiting: () => this.updateState({ isBuffering: true }),
      playing: () => this.updateState({ isBuffering: false }),
      timeupdate: () => this.updateState({ currentTime: this.video?.currentTime || 0 }),
      volumechange: () => this.updateState({
        volume: this.video?.volume || 0,
        muted: this.video?.muted || false
      }),
      error: () => {
        const error = this.video?.error;
        const videoError = new Error(`Video Error: ${error?.message || 'Unknown error'}`);
        this.updateState({ error: videoError });
        this.dispatchEvent(new CustomEvent('error', { detail: videoError }));
      },
    };

    Object.entries(events).forEach(([event, handler]) => {
      this.video!.addEventListener(event, handler);
      this.eventListeners.set(event, handler);
    });
  }

  private updateState(updates: Partial<VideoState>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Dispatch events for state changes
    Object.entries(updates).forEach(([key, value]) => {
      if (previousState[key as keyof VideoState] !== value) {
        this.dispatchEvent(new CustomEvent(key, { detail: value }));
      }
    });
  }

  async loadSource(src: string, config: Partial<VideoConfig> = {}): Promise<void> {
    if (!this.video) return;

    // Reset state
    this.updateState({
      isReady: false,
      isBuffering: true,
      error: null,
    });

    // Apply configuration
    if (config.muted !== undefined) this.video.muted = config.muted;
    if (config.volume !== undefined) this.video.volume = config.volume;
    if (config.autoplay !== undefined) this.video.autoplay = config.autoplay;
    if (config.loop !== undefined) this.video.loop = config.loop;
    if (config.preload !== undefined) this.video.preload = config.preload;

    // Handle HLS vs regular video
    const isHLS = src.includes('.m3u8');

    if (isHLS) {
      await this.loadHLS(src);
    } else {
      this.video.src = src;
      this.updateState({ isBuffering: false });
    }
  }

  private async loadHLS(src: string): Promise<void> {
    if (!this.video) return;

    try {
      // Cleanup previous HLS instance
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }

      // Dynamic import for better bundle splitting
      const { default: Hls } = await import('hls.js');

      if (!Hls.isSupported()) {
        // Fallback to native HLS
        this.video.src = src;
        return;
      }

      this.hls = new Hls({
        // Optimized for smooth background playback
        maxBufferLength: 25,
        maxMaxBufferLength: 50,
        maxBufferSize: 40 * 1000 * 1000, // 40MB
        maxBufferHole: 0.5,
        // Adaptive bitrate
        abrEwmaDefaultEstimate: 800000,
        abrEwmaSlowFactor: 2.0,
        abrEwmaFastFactor: 1.0,
        // Performance
        enableWorker: true,
        startLevel: -1,
        // Recovery
        maxLoadRetryCount: 2,
        maxFragRetryCount: 2,
      });

      this.hls.attachMedia(this.video);

      // HLS event handlers
      this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        this.hls.loadSource(src);
      });

      this.hls.on(Hls.Events.MANIFEST_LOADED, () => {
        this.updateState({ isReady: true, isBuffering: false });
        this.dispatchEvent(new Event('ready'));
      });

      this.hls.on(Hls.Events.ERROR, (_, data) => {
        const error = new Error(`HLS Error: ${data.type} - ${data.details}`);
        this.updateState({ error, isBuffering: false });
        this.dispatchEvent(new CustomEvent('error', { detail: error }));
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load HLS');
      this.updateState({ error: err, isBuffering: false });
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    }
  }

  // Public control methods
  async play(): Promise<void> {
    if (!this.video) return;
    await this.video.play();
  }

  pause(): void {
    if (!this.video) return;
    this.video.pause();
  }

  seek(time: number): void {
    if (!this.video) return;
    this.video.currentTime = Math.max(0, time);
  }

  setVolume(volume: number): void {
    if (!this.video) return;
    this.video.volume = Math.min(1, Math.max(0, volume));
  }

  setMuted(muted: boolean): void {
    if (!this.video) return;
    this.video.muted = muted;
  }

  // Getters
  getState(): VideoState {
    return { ...this.state };
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  // Cleanup
  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    // Remove event listeners
    this.eventListeners.forEach((handler, event) => {
      this.video?.removeEventListener(event, handler);
    });
    this.eventListeners.clear();

    this.video = null;
  }

  // Performance monitoring
  getPerformanceMetrics(): {
    buffered: TimeRanges | null;
    played: TimeRanges | null;
    seekable: TimeRanges | null;
  } {
    if (!this.video) return { buffered: null, played: null, seekable: null };

    return {
      buffered: this.video.buffered,
      played: this.video.played,
      seekable: this.video.seekable,
    };
  }
}
