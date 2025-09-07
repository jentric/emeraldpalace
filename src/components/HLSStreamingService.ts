import { performanceMonitor } from './VideoPerformanceMonitor';

export interface HLSConfig {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  maxBufferHole: number;
  abrEwmaDefaultEstimate: number;
  abrEwmaSlowFactor: number;
  abrEwmaFastFactor: number;
  enableWorker: boolean;
  startLevel: number;
  maxLoadRetryCount: number;
  maxFragRetryCount: number;
}

export interface QualityLevel {
  level: number;
  bitrate: number;
  resolution: { width: number; height: number };
  fps: number;
  name: string;
}

export class HLSStreamingService {
  private static instance: HLSStreamingService;
  private hls: any = null;
  private config: HLSConfig;
  private currentQualityLevel: number = -1;
  private qualityLevels: QualityLevel[] = [];
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.config = this.getOptimalConfig();
    this.setupPerformanceListener();
  }

  static getInstance(): HLSStreamingService {
    if (!HLSStreamingService.instance) {
      HLSStreamingService.instance = new HLSStreamingService();
    }
    return HLSStreamingService.instance;
  }

  private getOptimalConfig(): HLSConfig {
    // Detect device capabilities for optimal configuration
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType || '4g';
    const downlink = connection?.downlink || 10;

    // Base configuration optimized for smooth playback
    const baseConfig: HLSConfig = {
      maxBufferLength: 25,
      maxMaxBufferLength: 50,
      maxBufferSize: 40 * 1000 * 1000, // 40MB
      maxBufferHole: 0.5,
      abrEwmaDefaultEstimate: 800000,
      abrEwmaSlowFactor: 2.0,
      abrEwmaFastFactor: 1.0,
      enableWorker: true,
      startLevel: -1, // Auto quality selection
      maxLoadRetryCount: 3,
      maxFragRetryCount: 3,
    };

    // Mobile optimizations
    if (isMobile) {
      baseConfig.maxBufferLength = 15;
      baseConfig.maxMaxBufferLength = 30;
      baseConfig.maxBufferSize = 20 * 1000 * 1000; // 20MB
      baseConfig.abrEwmaDefaultEstimate = 400000;
      baseConfig.abrEwmaSlowFactor = 2.5;
      baseConfig.abrEwmaFastFactor = 0.8;
    }

    // Slow connection optimizations
    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
      baseConfig.maxBufferLength = 10;
      baseConfig.maxMaxBufferLength = 20;
      baseConfig.maxBufferSize = 15 * 1000 * 1000; // 15MB
      baseConfig.abrEwmaDefaultEstimate = 200000;
    } else if (effectiveType === '3g' || downlink < 5) {
      baseConfig.abrEwmaDefaultEstimate = 500000;
    }

    return baseConfig;
  }

  private setupPerformanceListener(): void {
    // Listen for quality recommendations from performance monitor
    const handleRecommendation = (metrics: any, recommendation: any) => {
      if (recommendation.action === 'decrease') {
        this.decreaseQuality();
      } else if (recommendation.action === 'increase') {
        this.increaseQuality();
      }
    };

    performanceMonitor.onRecommendation(handleRecommendation);
  }

  async initialize(videoElement: HTMLVideoElement, manifestUrl: string): Promise<void> {
    try {
      // Dynamic import to reduce initial bundle size
      const { default: Hls } = await import('hls.js');

      if (!Hls.isSupported()) {
        // Fallback to native HLS support (Safari)
        videoElement.src = manifestUrl;
        return;
      }

      // Clean up previous instance
      if (this.hls) {
        this.hls.destroy();
      }

      // Create new HLS instance with optimized config
      this.hls = new Hls(this.config);

      // Set up event listeners
      this.setupHLSEvents();

      // Attach to video element
      this.hls.attachMedia(videoElement);

      // Load manifest
      this.hls.loadSource(manifestUrl);

    } catch (error) {
      console.error('Failed to initialize HLS:', error);
      throw error;
    }
  }

  private setupHLSEvents(): void {
    if (!this.hls) return;

    // Manifest loaded - get available quality levels
    this.hls.on(Hls.Events.MANIFEST_LOADED, (event: any, data: any) => {
      this.qualityLevels = data.levels.map((level: any, index: number) => ({
        level: index,
        bitrate: level.bitrate,
        resolution: {
          width: level.width,
          height: level.height,
        },
        fps: level.frameRate || 30,
        name: this.getQualityName(level),
      }));

      this.emit('manifestLoaded', this.qualityLevels);
    });

    // Fragment loaded - track bandwidth
    this.hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
      this.emit('fragmentLoaded', data);
    });

    // Level switched - quality change
    this.hls.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
      this.currentQualityLevel = data.level;
      const quality = this.qualityLevels[data.level];
      this.emit('qualityChanged', quality);
    });

    // Error handling with recovery
    this.hls.on(Hls.Events.ERROR, (event: any, data: any) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.warn('HLS Network error, attempting recovery');
            this.hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn('HLS Media error, attempting recovery');
            this.hls.recoverMediaError();
            break;
          default:
            console.error('HLS Fatal error:', data);
            this.emit('error', data);
            break;
        }
      } else {
        console.warn('HLS Non-fatal error:', data);
      }
    });
  }

  private getQualityName(level: any): string {
    const { width, height } = level;
    const bitrate = Math.round(level.bitrate / 1000); // kbps

    if (width >= 1920 || height >= 1080) return `${bitrate}k 1080p`;
    if (width >= 1280 || height >= 720) return `${bitrate}k 720p`;
    if (width >= 854 || height >= 480) return `${bitrate}k 480p`;
    if (width >= 640 || height >= 360) return `${bitrate}k 360p`;
    return `${bitrate}k ${height}p`;
  }

  // Quality control methods
  setQualityLevel(level: number): void {
    if (this.hls && level >= -1 && level < this.qualityLevels.length) {
      this.hls.currentLevel = level;
      this.currentQualityLevel = level;
    }
  }

  increaseQuality(): void {
    const nextLevel = Math.min(this.currentQualityLevel + 1, this.qualityLevels.length - 1);
    this.setQualityLevel(nextLevel);
  }

  decreaseQuality(): void {
    const nextLevel = Math.max(this.currentQualityLevel - 1, 0);
    this.setQualityLevel(nextLevel);
  }

  getCurrentQuality(): QualityLevel | null {
    if (this.currentQualityLevel === -1 || !this.qualityLevels[this.currentQualityLevel]) {
      return null;
    }
    return this.qualityLevels[this.currentQualityLevel];
  }

  getAvailableQualities(): QualityLevel[] {
    return [...this.qualityLevels];
  }

  // Adaptive bitrate methods
  enableABR(): void {
    if (this.hls) {
      this.hls.currentLevel = -1; // Auto mode
      this.currentQualityLevel = -1;
    }
  }

  disableABR(): void {
    // Keep current level when disabling ABR
  }

  // Performance monitoring integration
  getPerformanceMetrics(): {
    bufferLength: number;
    bandwidthEstimate: number;
    currentLevel: number;
    nextLoadLevel: number;
  } {
    if (!this.hls) {
      return {
        bufferLength: 0,
        bandwidthEstimate: 0,
        currentLevel: -1,
        nextLoadLevel: -1,
      };
    }

    return {
      bufferLength: this.hls.bufferController?.bufferInfo?.buffered || 0,
      bandwidthEstimate: this.hls.bandwidthEstimate || 0,
      currentLevel: this.hls.currentLevel,
      nextLoadLevel: this.hls.nextLoadLevel,
    };
  }

  // Event system
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in HLS event callback:', error);
        }
      });
    }
  }

  // Cleanup
  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    this.listeners.clear();
    this.qualityLevels = [];
    this.currentQualityLevel = -1;
  }
}

// Export singleton instance
export const hlsStreamingService = HLSStreamingService.getInstance();

// Extend the global Hls interface for better TypeScript support
declare global {
  interface Window {
    Hls: any;
  }
}
