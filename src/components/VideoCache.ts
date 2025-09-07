export interface CacheEntry {
  url: string;
  size: number;
  lastAccessed: number;
  expiresAt: number;
  etag?: string;
  contentType?: string;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxAge: number; // Maximum age in milliseconds
  maxEntries: number; // Maximum number of entries
  strategy: 'lru' | 'fifo' | 'lfu'; // Cache replacement strategy
}

export class VideoCache {
  private static instance: VideoCache;
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 500 * 1024 * 1024, // 500MB default
      maxAge: 24 * 60 * 60 * 1000, // 24 hours default
      maxEntries: 50, // 50 entries default
      strategy: 'lru',
      ...config,
    };

    this.loadFromStorage();
    this.setupCleanup();
  }

  static getInstance(config?: Partial<CacheConfig>): VideoCache {
    if (!VideoCache.instance) {
      VideoCache.instance = new VideoCache(config);
    }
    return VideoCache.instance;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('video-cache');
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
      this.cache.clear();
    }
  }

  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem('video-cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  private setupCleanup(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
    });
  }

  private cleanup(): void {
    const now = Date.now();
    let totalSize = 0;

    // Remove expired entries
    for (const [url, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(url);
      } else {
        totalSize += entry.size;
      }
    }

    // Apply size limits based on strategy
    if (totalSize > this.config.maxSize || this.cache.size > this.config.maxEntries) {
      this.applyEvictionPolicy();
    }

    this.saveToStorage();
  }

  private applyEvictionPolicy(): void {
    const entries = Array.from(this.cache.entries());

    switch (this.config.strategy) {
      case 'lru':
        // Least Recently Used
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        break;
      case 'fifo':
        // First In First Out
        entries.sort(([, a], [, b]) => a.expiresAt - b.expiresAt);
        break;
      case 'lfu':
        // Least Frequently Used (simplified - we don't track access count)
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        break;
    }

    // Remove entries until we're under limits
    let totalSize = entries.reduce((sum, [, entry]) => sum + entry.size, 0);

    for (const [url] of entries) {
      if (this.cache.size <= this.config.maxEntries && totalSize <= this.config.maxSize) {
        break;
      }

      const entry = this.cache.get(url);
      if (entry) {
        totalSize -= entry.size;
        this.cache.delete(url);
      }
    }
  }

  async isCached(url: string): Promise<boolean> {
    const entry = this.cache.get(url);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(url);
      return false;
    }

    return true;
  }

  async get(url: string): Promise<Response | null> {
    const entry = this.cache.get(url);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(url);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    this.cache.set(url, entry);

    // Try to get from Cache API
    try {
      const cache = await caches.open('video-cache');
      const cachedResponse = await cache.match(url);

      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (error) {
      console.warn('Cache API not available:', error);
    }

    return null;
  }

  async put(url: string, response: Response): Promise<void> {
    try {
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const etag = response.headers.get('etag') || undefined;
      const contentType = response.headers.get('content-type') || undefined;

      // Don't cache if too large
      if (contentLength > this.config.maxSize * 0.1) { // Don't cache files larger than 10% of max cache size
        return;
      }

      // Create cache entry
      const entry: CacheEntry = {
        url,
        size: contentLength,
        lastAccessed: Date.now(),
        expiresAt: Date.now() + this.config.maxAge,
        etag,
        contentType,
      };

      // Store in memory cache
      this.cache.set(url, entry);

      // Store in Cache API if available
      if ('caches' in window) {
        const cache = await caches.open('video-cache');
        await cache.put(url, response.clone());
      }

      // Apply eviction policy
      this.cleanup();

    } catch (error) {
      console.warn('Failed to cache response:', error);
    }
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Check if we have a cached version
    const cachedResponse = await this.get(url);
    if (cachedResponse) {
      // Add cache headers for conditional requests
      const headers = new Headers(options.headers);
      const entry = this.cache.get(url);

      if (entry?.etag) {
        headers.set('If-None-Match', entry.etag);
      }

      options.headers = headers;
    }

    try {
      const response = await fetch(url, options);

      // Cache successful responses
      if (response.ok && response.status !== 304) {
        await this.put(url, response.clone());
      }

      return response;
    } catch (error) {
      // If network fails and we have a cached version, return it
      if (cachedResponse) {
        console.warn('Network failed, using cached version for:', url);
        return cachedResponse;
      }

      throw error;
    }
  }

  async preload(url: string, priority: 'low' | 'high' = 'low'): Promise<void> {
    if (await this.isCached(url)) {
      return; // Already cached
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Priority': priority,
          'Cache-Control': 'no-cache', // Force fresh fetch for preloading
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        await this.put(url, response);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Failed to preload video:', url, error);
      }
    }
  }

  async preloadMultiple(urls: string[], priority: 'low' | 'high' = 'low'): Promise<void> {
    // Limit concurrent preloads to avoid overwhelming the network
    const concurrency = priority === 'high' ? 3 : 2;

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      await Promise.allSettled(batch.map(url => this.preload(url, priority)));
    }
  }

  getStats(): {
    entries: number;
    totalSize: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let totalSize = 0;
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      if (oldest === null || entry.lastAccessed < oldest) {
        oldest = entry.lastAccessed;
      }
      if (newest === null || entry.lastAccessed > newest) {
        newest = entry.lastAccessed;
      }
    }

    return {
      entries: this.cache.size,
      totalSize,
      hitRate: 0, // Would need to track hits/misses separately
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  clear(): void {
    this.cache.clear();

    // Clear Cache API
    if ('caches' in window) {
      caches.delete('video-cache').catch(error =>
        console.warn('Failed to clear Cache API:', error)
      );
    }

    try {
      localStorage.removeItem('video-cache');
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }
}

// Export singleton instance
export const videoCache = VideoCache.getInstance();
