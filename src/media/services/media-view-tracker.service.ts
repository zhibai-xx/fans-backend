import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface TrackerIdentity {
  userId?: number | null;
  sessionId?: string | null;
  ip?: string | null;
}

@Injectable()
export class MediaViewTrackerService implements OnModuleDestroy {
  private readonly ttlMs = 30 * 60 * 1000; // 30分钟
  private readonly viewCache = new Map<string, number>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.ttlMs).unref();
  }

  shouldCount(mediaId: string, identity: TrackerIdentity): boolean {
    const key = this.buildKey(mediaId, identity);
    const now = Date.now();
    const lastSeen = this.viewCache.get(key);

    if (lastSeen && now - lastSeen < this.ttlMs) {
      return false;
    }

    this.viewCache.set(key, now);
    return true;
  }

  private buildKey(mediaId: string, identity: TrackerIdentity): string {
    if (identity.userId) {
      return `user:${identity.userId}:media:${mediaId}`;
    }
    if (identity.sessionId) {
      return `session:${identity.sessionId}:media:${mediaId}`;
    }
    if (identity.ip) {
      return `ip:${identity.ip}:media:${mediaId}`;
    }
    return `anonymous:${mediaId}`;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.viewCache.entries()) {
      if (now - timestamp >= this.ttlMs) {
        this.viewCache.delete(key);
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }
}
