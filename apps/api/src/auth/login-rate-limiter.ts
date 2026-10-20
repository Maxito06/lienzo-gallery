import { Injectable } from '@nestjs/common';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const MAX_TRACKED_KEYS = 10_000;

// Límite de intentos fallidos de login por clave (correo), en memoria
@Injectable()
export class LoginRateLimiter {
  private readonly entries = new Map<string, { count: number; windowStart: number }>();

  private normalize(key: string): string {
    return key.trim().toLowerCase();
  }

  retryAfterSeconds(key: string, now: Date = new Date()): number {
    const k = this.normalize(key);
    const entry = this.entries.get(k);
    if (!entry) return 0;
    if (now.getTime() - entry.windowStart >= LOCK_WINDOW_MS) {
      this.entries.delete(k);
      return 0;
    }
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      return Math.ceil((entry.windowStart + LOCK_WINDOW_MS - now.getTime()) / 1000);
    }
    return 0;
  }

  recordFailure(key: string, now: Date = new Date()): void {
    const k = this.normalize(key);
    const entry = this.entries.get(k);
    if (!entry || now.getTime() - entry.windowStart >= LOCK_WINDOW_MS) {
      if (entry) this.entries.delete(k);
      if (this.entries.size >= MAX_TRACKED_KEYS) {
        // Se descarta la clave más antigua
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
      this.entries.set(k, { count: 1, windowStart: now.getTime() });
      return;
    }
    entry.count += 1;
  }

  reset(key: string): void {
    this.entries.delete(this.normalize(key));
  }

  get size(): number {
    return this.entries.size;
  }
}
