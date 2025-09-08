/**
 * Browser Compatibility Utilities for Video Playback
 * Provides comprehensive browser detection and codec support checking
 */

export interface BrowserCapabilities {
  name: string;
  version: string;
  isMobile: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  supportsHLS: boolean;
  supportsMSE: boolean;
  supportsWebRTC: boolean;
  codecSupport: CodecSupport;
  recommendedConfig: HLSConfig;
}

export interface CodecSupport {
  h264Baseline: boolean;
  h264Main: boolean;
  h264High: boolean;
  h264High10: boolean;
  h264High422: boolean;
  h264High444: boolean;
  vp8: boolean;
  vp9: boolean;
  av1: boolean;
  hevc: boolean;
  hevcMain10: boolean;
  opus: boolean;
  aacLC: boolean;
  aacHE: boolean;
  flac: boolean;
}

export interface HLSConfig {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  maxBufferHole: number;
  enableWorker: boolean;
  enableSoftwareAES: boolean;
  startLevel: number;
  maxLoadRetryCount: number;
  maxFragRetryCount: number;
  abrEwmaDefaultEstimate: number;
  xhrTimeout: number;
}

export class BrowserCompatibilityDetector {
  private static instance: BrowserCompatibilityDetector;
  private capabilities: BrowserCapabilities | null = null;

  static getInstance(): BrowserCompatibilityDetector {
    if (!BrowserCompatibilityDetector.instance) {
      BrowserCompatibilityDetector.instance = new BrowserCompatibilityDetector();
    }
    return BrowserCompatibilityDetector.instance;
  }

  /**
   * Get comprehensive browser capabilities
   */
  getCapabilities(): BrowserCapabilities {
    if (!this.capabilities) {
      this.capabilities = this.detectCapabilities();
    }
    return this.capabilities;
  }

  /**
   * Detect all browser capabilities
   */
  private detectCapabilities(): BrowserCapabilities {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Browser detection
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isChrome = /Chrome/i.test(userAgent) && !/Edg/i.test(userAgent);
    const isFirefox = /Firefox/i.test(userAgent);
    const isEdge = /Edg/i.test(userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(platform) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(platform));
    const isAndroid = /Android/i.test(userAgent);

    // Extract browser name and version
    const browserInfo = this.getBrowserInfo(userAgent);
    const name = browserInfo.name;
    const version = browserInfo.version;

    // Codec support detection
    const codecSupport = this.detectCodecSupport();

    // Feature support
    const supportsMSE = 'MediaSource' in window && MediaSource.isTypeSupported !== undefined;
    const supportsHLS = this.detectHLSSupport();
    const supportsWebRTC = !!(window.RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection ||
      (window as any).mozRTCPeerConnection);

    // Generate recommended HLS config
    const recommendedConfig = this.generateOptimalHLSConfig({
      name,
      version,
      isMobile,
      isSafari,
      isChrome,
      isFirefox,
      isEdge,
      isIOS,
      isAndroid,
      supportsHLS,
      supportsMSE,
      supportsWebRTC,
      codecSupport
    });

    return {
      name,
      version,
      isMobile,
      isSafari,
      isChrome,
      isFirefox,
      isEdge,
      isIOS,
      isAndroid,
      supportsHLS,
      supportsMSE,
      supportsWebRTC,
      codecSupport,
      recommendedConfig
    };
  }

  /**
   * Extract browser name and version from user agent
   */
  private getBrowserInfo(userAgent: string): { name: string; version: string } {
    const browsers = [
      { name: 'Chrome', regex: /Chrome\/([0-9.]+)/ },
      { name: 'Firefox', regex: /Firefox\/([0-9.]+)/ },
      { name: 'Safari', regex: /Version\/([0-9.]+).*Safari/ },
      { name: 'Edge', regex: /Edg\/([0-9.]+)/ },
      { name: 'Opera', regex: /OPR\/([0-9.]+)/ },
      { name: 'IE', regex: /MSIE ([0-9.]+)/ }
    ];

    for (const browser of browsers) {
      const match = userAgent.match(browser.regex);
      if (match) {
        return { name: browser.name, version: match[1] };
      }
    }

    return { name: 'Unknown', version: '0.0' };
  }

  /**
   * Comprehensive codec support detection
   */
  private detectCodecSupport(): CodecSupport {
    const video = document.createElement('video');
    const audio = document.createElement('audio');

    return {
      // H.264 variants
      h264Baseline: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
      h264Main: video.canPlayType('video/mp4; codecs="avc1.4D401E"') !== '',
      h264High: video.canPlayType('video/mp4; codecs="avc1.640028"') !== '',
      h264High10: video.canPlayType('video/mp4; codecs="avc1.64002A"') !== '',
      h264High422: video.canPlayType('video/mp4; codecs="avc1.640032"') !== '',
      h264High444: video.canPlayType('video/mp4; codecs="avc1.640034"') !== '',

      // Alternative video codecs
      vp8: video.canPlayType('video/webm; codecs="vp8"') !== '',
      vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
      av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== '',
      hevc: video.canPlayType('video/mp4; codecs="hvc1"') !== '',
      hevcMain10: video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== '',

      // Audio codecs
      opus: audio.canPlayType('audio/webm; codecs="opus"') !== '',
      aacLC: audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
      aacHE: audio.canPlayType('audio/mp4; codecs="mp4a.40.5"') !== '',
      flac: audio.canPlayType('audio/flac') !== ''
    };
  }

  /**
   * Detect HLS support (native or MSE-based)
   */
  private detectHLSSupport(): boolean {
    const video = document.createElement('video');

    // Check for native HLS support (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
      return true;
    }

    // Check for MSE-based HLS support
    if ('MediaSource' in window && MediaSource.isTypeSupported) {
      return MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"') ||
             MediaSource.isTypeSupported('video/mp4; codecs="avc1.4D401E"') ||
             MediaSource.isTypeSupported('video/mp4; codecs="avc1.640028"');
    }

    return false;
  }

  /**
   * Generate optimal HLS configuration based on browser capabilities
   */
  private generateOptimalHLSConfig(capabilities: Omit<BrowserCapabilities, 'recommendedConfig'>): HLSConfig {
    const baseConfig: HLSConfig = {
      maxBufferLength: 25,
      maxMaxBufferLength: 50,
      maxBufferSize: 40 * 1000 * 1000, // 40MB
      maxBufferHole: 0.5,
      enableWorker: true,
      enableSoftwareAES: false,
      startLevel: -1,
      maxLoadRetryCount: 3,
      maxFragRetryCount: 3,
      abrEwmaDefaultEstimate: 800000,
      xhrTimeout: 12000
    };

    // Safari-specific optimizations
    if (capabilities.isSafari) {
      return {
        ...baseConfig,
        enableWorker: false, // Safari performs better without web workers
        enableSoftwareAES: false, // Safari has hardware AES
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 30 * 1000 * 1000, // 30MB
        xhrTimeout: 10000
      };
    }

    // Mobile optimizations
    if (capabilities.isMobile) {
      return {
        ...baseConfig,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 20 * 1000 * 1000, // 20MB
        maxBufferHole: 0.5,
        maxLoadRetryCount: 6,
        maxFragRetryCount: 6,
        abrEwmaDefaultEstimate: 400000,
        xhrTimeout: 15000
      };
    }

    // Firefox optimizations
    if (capabilities.isFirefox) {
      return {
        ...baseConfig,
        enableWorker: false, // Firefox has issues with web workers in some versions
        enableSoftwareAES: true, // Firefox benefits from software AES
        maxBufferLength: 20,
        maxMaxBufferLength: 40
      };
    }

    // Chrome optimizations
    if (capabilities.isChrome) {
      return {
        ...baseConfig,
        enableWorker: true,
        enableSoftwareAES: false,
        abrEwmaDefaultEstimate: 1000000, // Chrome can handle higher bitrates
        maxBufferSize: 50 * 1000 * 1000 // 50MB
      };
    }

    return baseConfig;
  }

  /**
   * Get fallback video formats for incompatible browsers
   */
  getFallbackFormats(originalSrc: string): string[] {
    const fallbacks: string[] = [];

    // If HLS, try MP4 fallback
    if (originalSrc.includes('.m3u8')) {
      const mp4Fallback = originalSrc.replace(/\/videos\/hls\/[^/]+\/index\.m3u8$/, (match) => {
        const baseName = match.split('/')[3];
        return `/videos/${decodeURIComponent(baseName)}.mp4`;
      });

      if (mp4Fallback !== originalSrc) {
        fallbacks.push(mp4Fallback);
      }

      // Try WebM fallback
      const webmFallback = mp4Fallback.replace('.mp4', '.webm');
      fallbacks.push(webmFallback);
    }

    return fallbacks;
  }

  /**
   * Check if browser supports a specific codec combination
   */
  supportsCodec(videoCodec: string, audioCodec: string, container: string = 'mp4'): boolean {
    const video = document.createElement('video');
    const mimeType = `video/${container}; codecs="${videoCodec}, ${audioCodec}"`;
    return video.canPlayType(mimeType) !== '';
  }

  /**
   * Get recommended video quality based on browser capabilities and connection
   */
  getRecommendedQuality(connectionSpeed?: number): 'low' | 'medium' | 'high' | 'auto' {
    const capabilities = this.getCapabilities();

    // Mobile devices default to lower quality
    if (capabilities.isMobile) {
      return connectionSpeed && connectionSpeed < 1 ? 'low' : 'medium';
    }

    // Safari can handle high quality well
    if (capabilities.isSafari) {
      return 'high';
    }

    // Chrome and modern browsers
    if (capabilities.isChrome) {
      return connectionSpeed && connectionSpeed < 2 ? 'medium' : 'high';
    }

    return 'auto';
  }

  /**
   * Check if browser needs special handling for video playback
   */
  needsSpecialHandling(): { reason: string; action: string } | null {
    const capabilities = this.getCapabilities();

    // iOS Safari needs special handling for autoplay
    if (capabilities.isIOS && capabilities.isSafari) {
      return {
        reason: 'iOS Safari requires user interaction for autoplay',
        action: 'delay_autoplay'
      };
    }

    // Older Safari versions need codec-specific handling
    if (capabilities.isSafari && parseFloat(capabilities.version) < 14) {
      return {
        reason: 'Older Safari versions have limited codec support',
        action: 'force_mp4_fallback'
      };
    }

    // Android Chrome needs user interaction for autoplay
    if (capabilities.isAndroid && capabilities.isChrome) {
      return {
        reason: 'Android Chrome requires user interaction for autoplay',
        action: 'delay_autoplay'
      };
    }

    return null;
  }

  /**
   * Get browser-specific video element attributes
   */
  getVideoAttributes(): Record<string, string | boolean> {
    const capabilities = this.getCapabilities();
    const attributes: Record<string, string | boolean> = {
      preload: 'metadata',
      playsInline: true,
      'webkit-playsinline': true,
    };

    // iOS-specific attributes
    if (capabilities.isIOS) {
      attributes.muted = true; // Required for autoplay on iOS
      attributes.autoPlay = false; // Delay autoplay until user interaction
    }

    // Android-specific attributes
    if (capabilities.isAndroid) {
      attributes.muted = true; // Required for autoplay on Android
      attributes.autoPlay = false; // Delay autoplay until user interaction
    }

    // Disable features not needed for background video
    attributes.disablePictureInPicture = true;
    attributes.disableRemotePlayback = true;

    return attributes;
  }
}

// Export singleton instance
export const browserCompatibility = BrowserCompatibilityDetector.getInstance();
