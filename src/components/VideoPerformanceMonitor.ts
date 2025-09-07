export interface PerformanceMetrics {
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  bufferingTime: number;
  bandwidth: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface QualityLevel {
  level: number;
  bitrate: number;
  resolution: { width: number; height: number };
  fps: number;
}

export interface AdaptiveConfig {
  targetFps: number;
  maxDroppedFrames: number;
  minBandwidth: number;
  maxBufferingTime: number;
  memoryThreshold: number;
  cpuThreshold: number;
  adjustmentCooldown: number; // ms between quality adjustments
}

export class VideoPerformanceMonitor {
  private static instance: VideoPerformanceMonitor;
  private metrics: PerformanceMetrics = {
    fps: 0,
    droppedFrames: 0,
    totalFrames: 0,
    bufferingTime: 0,
    bandwidth: 0,
    latency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };

  private config: AdaptiveConfig = {
    targetFps: 30,
    maxDroppedFrames: 0.1, // 10% of frames
    minBandwidth: 1000000, // 1 Mbps
    maxBufferingTime: 2000, // 2 seconds
    memoryThreshold: 0.8, // 80% memory usage
    cpuThreshold: 0.7, // 70% CPU usage
    adjustmentCooldown: 5000, // 5 seconds
  };

  private video: HTMLVideoElement | null = null;
  private hls: any = null;
  private isMonitoring = false;
  private lastAdjustment = 0;
  private frameCount = 0;
  private lastFrameTime = 0;
  private bufferingStartTime = 0;
  private observers: ((metrics: PerformanceMetrics, recommendation: QualityRecommendation) => void)[] = [];

  private constructor() {
    this.setupPerformanceObserver();
  }

  static getInstance(): VideoPerformanceMonitor {
    if (!VideoPerformanceMonitor.instance) {
      VideoPerformanceMonitor.instance = new VideoPerformanceMonitor();
    }
    return VideoPerformanceMonitor.instance;
  }

  attach(video: HTMLVideoElement, hls?: any): void {
    this.video = video;
    this.hls = hls;
    this.resetMetrics();
    this.startMonitoring();
  }

  detach(): void {
    this.video = null;
    this.hls = null;
    this.stopMonitoring();
  }

  private resetMetrics(): void {
    this.metrics = {
      fps: 0,
      droppedFrames: 0,
      totalFrames: 0,
      bufferingTime: 0,
      bandwidth: 0,
      latency: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.bufferingStartTime = 0;
  }

  private startMonitoring(): void {
    if (this.isMonitoring || !this.video) return;

    this.isMonitoring = true;
    this.setupVideoObservers();
    this.startMetricsCollection();
  }

  private stopMonitoring(): void {
    this.isMonitoring = false;
    // Cleanup would happen here if needed
  }

  private setupVideoObservers(): void {
    if (!this.video) return;

    const handleTimeUpdate = () => {
      if (!this.lastFrameTime) {
        this.lastFrameTime = performance.now();
        return;
      }

      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;

      if (deltaTime >= 1000) { // Update FPS every second
        this.metrics.fps = (this.frameCount * 1000) / deltaTime;
        this.frameCount = 0;
        this.lastFrameTime = now;

        // Check for frame drops using getVideoPlaybackQuality if available
        this.updateFrameQuality();
        this.updateSystemMetrics();
        this.checkAndNotify();
      }

      this.frameCount++;
    };

    const handleWaiting = () => {
      this.bufferingStartTime = performance.now();
    };

    const handlePlaying = () => {
      if (this.bufferingStartTime) {
        const bufferingDuration = performance.now() - this.bufferingStartTime;
        this.metrics.bufferingTime += bufferingDuration;
        this.bufferingStartTime = 0;
      }
    };

    this.video.addEventListener('timeupdate', handleTimeUpdate);
    this.video.addEventListener('waiting', handleWaiting);
    this.video.addEventListener('playing', handlePlaying);
  }

  private updateFrameQuality(): void {
    if (!this.video) return;

    try {
      // Try to get frame quality metrics
      const quality = (this.video as any).getVideoPlaybackQuality?.();
      if (quality) {
        this.metrics.totalFrames = quality.totalVideoFrames;
        this.metrics.droppedFrames = quality.droppedVideoFrames;
      } else {
        // Fallback: estimate dropped frames based on FPS
        const expectedFrames = this.config.targetFps;
        const actualFrames = this.metrics.fps;
        if (actualFrames < expectedFrames * 0.8) {
          this.metrics.droppedFrames += Math.max(0, expectedFrames - actualFrames);
        }
      }
    } catch (error) {
      // Ignore errors in frame quality detection
    }
  }

  private updateSystemMetrics(): void {
    try {
      // Memory usage
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        this.metrics.memoryUsage = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
      }

      // Network information
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        if (conn) {
          this.metrics.bandwidth = conn.downlink * 1000000; // Convert to bps
          this.metrics.latency = conn.rtt;
        }
      }

      // CPU usage estimation (simplified)
      // This is a rough estimate based on frame timing consistency
      const frameVariance = this.calculateFrameVariance();
      this.metrics.cpuUsage = Math.min(1, Math.max(0, 1 - (frameVariance / 100)));
    } catch (error) {
      // Ignore system metric collection errors
    }
  }

  private calculateFrameVariance(): number {
    // This is a simplified frame variance calculation
    // In a real implementation, you'd track frame timestamps more precisely
    const targetFrameTime = 1000 / this.config.targetFps;
    const currentFrameTime = this.metrics.fps > 0 ? 1000 / this.metrics.fps : targetFrameTime;
    return Math.abs(currentFrameTime - targetFrameTime);
  }

  private startMetricsCollection(): void {
    // Periodic metrics collection for HLS-specific metrics
    const collectHlsMetrics = () => {
      if (!this.isMonitoring || !this.hls) return;

      try {
        const stats = this.hls.stats;
        if (stats) {
          // HLS-specific metrics
          this.metrics.bandwidth = stats.bandwidthEstimate || this.metrics.bandwidth;
        }
      } catch (error) {
        // Ignore HLS metrics collection errors
      }
    };

    setInterval(collectHlsMetrics, 1000);
  }

  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              // Custom performance marks can be used here
              this.metrics.latency = entry.duration;
            }
          }
        });

        observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        // Performance observer not supported or failed to initialize
      }
    }
  }

  private checkAndNotify(): void {
    const now = Date.now();
    if (now - this.lastAdjustment < this.config.adjustmentCooldown) {
      return;
    }

    const recommendation = this.getQualityRecommendation();
    if (recommendation.action !== 'none') {
      this.lastAdjustment = now;
      this.notifyObservers(recommendation);
    }
  }

  private getQualityRecommendation(): QualityRecommendation {
    const { fps, droppedFrames, totalFrames, bufferingTime, bandwidth, memoryUsage, cpuUsage } = this.metrics;

    // Frame drop ratio
    const dropRatio = totalFrames > 0 ? droppedFrames / totalFrames : 0;

    // Performance score (0-1, higher is better)
    let performanceScore = 1.0;

    // FPS impact
    if (fps < this.config.targetFps * 0.8) {
      performanceScore *= 0.7;
    }

    // Frame drop impact
    if (dropRatio > this.config.maxDroppedFrames) {
      performanceScore *= 0.6;
    }

    // Buffering impact
    if (bufferingTime > this.config.maxBufferingTime) {
      performanceScore *= 0.8;
    }

    // Bandwidth impact
    if (bandwidth < this.config.minBandwidth) {
      performanceScore *= 0.9;
    }

    // System resource impact
    if (memoryUsage > this.config.memoryThreshold) {
      performanceScore *= 0.85;
    }

    if (cpuUsage > this.config.cpuThreshold) {
      performanceScore *= 0.85;
    }

    // Determine action based on performance score
    if (performanceScore < 0.5) {
      return { action: 'decrease', reason: 'Poor performance detected', metrics: this.metrics };
    } else if (performanceScore > 0.9 && bandwidth > this.config.minBandwidth * 2) {
      return { action: 'increase', reason: 'Good performance, can improve quality', metrics: this.metrics };
    }

    return { action: 'none', reason: 'Performance acceptable', metrics: this.metrics };
  }

  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  updateConfig(newConfig: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  onRecommendation(callback: (metrics: PerformanceMetrics, recommendation: QualityRecommendation) => void): () => void {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  private notifyObservers(recommendation: QualityRecommendation): void {
    this.observers.forEach(observer => {
      observer(this.metrics, recommendation);
    });
  }

  // Manual quality adjustment methods
  forceQualityLevel(level: number): void {
    if (this.hls && typeof this.hls.currentLevel === 'number') {
      this.hls.currentLevel = level;
    }
  }

  getAvailableLevels(): QualityLevel[] {
    if (!this.hls || !this.hls.levels) return [];

    return this.hls.levels.map((level: any, index: number) => ({
      level: index,
      bitrate: level.bitrate,
      resolution: {
        width: level.width,
        height: level.height,
      },
      fps: level.frameRate || 30,
    }));
  }
}

export interface QualityRecommendation {
  action: 'increase' | 'decrease' | 'none';
  reason: string;
  metrics: PerformanceMetrics;
}

// Export singleton instance
export const performanceMonitor = VideoPerformanceMonitor.getInstance();
