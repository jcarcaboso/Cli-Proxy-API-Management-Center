/**
 * Last-known-good quota snapshots, served only when a live read fails.
 *
 * Some usage endpoints (Codex) fail intermittently. Without a fallback, a card
 * that rendered fine a minute ago flips to an error. A snapshot is served only
 * while it can still be trusted:
 * - it is at most `maxAgeMs` old;
 * - no window has reset since it was read, because its usage would be wrong;
 * - it has not been invalidated by a quota mutation (reset-credit redemption)
 *   or a quota cache clear (auth-file change, logout, connection switch).
 *
 * React-free and clock-injectable so the invalidation rules are directly testable.
 */

import { MINUTE_MS } from '@/utils/time/durations';

export const QUOTA_FALLBACK_MAX_AGE_MS = 15 * MINUTE_MS;

export interface QuotaFallbackSnapshot<T> {
  data: T;
  savedAt: number;
}

export interface QuotaFallbackCache<T> {
  /** Token taken before a live read; `store` drops results invalidated meanwhile. */
  capture(fileName: string): string;
  store(key: string, fileName: string, data: T, generation: string): void;
  read(key: string): QuotaFallbackSnapshot<T> | null;
  invalidate(key: string): void;
  /** Drops snapshots for the given auth files, or every snapshot when omitted. */
  invalidateFiles(names?: string[]): void;
}

interface QuotaFallbackEntry<T> extends QuotaFallbackSnapshot<T> {
  fileName: string;
}

type WindowedQuotaData = { windows: { resetAtMs?: number | null }[] };

export interface QuotaFallbackCacheOptions {
  maxAgeMs?: number;
  now?: () => number;
}

const registeredCaches = new Set<QuotaFallbackCache<unknown>>();

export function createQuotaFallbackCache<T extends WindowedQuotaData>(
  options: QuotaFallbackCacheOptions = {}
): QuotaFallbackCache<T> {
  const { maxAgeMs = QUOTA_FALLBACK_MAX_AGE_MS, now = Date.now } = options;
  const entries = new Map<string, QuotaFallbackEntry<T>>();
  let globalGeneration = 0;
  const fileGenerations = new Map<string, number>();
  const generationOf = (fileName: string) =>
    `${globalGeneration}:${fileGenerations.get(fileName) ?? 0}`;

  const isTrusted = (entry: QuotaFallbackEntry<T>, at: number): boolean =>
    at - entry.savedAt <= maxAgeMs &&
    entry.data.windows.every(
      (window) =>
        typeof window.resetAtMs !== 'number' ||
        !Number.isFinite(window.resetAtMs) ||
        window.resetAtMs > at
    );

  const cache: QuotaFallbackCache<T> = {
    capture(fileName) {
      return generationOf(fileName);
    },
    store(key, fileName, data, generation) {
      if (generation !== generationOf(fileName)) return;
      entries.set(key, { data, fileName, savedAt: now() });
    },
    read(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (!isTrusted(entry, now())) {
        entries.delete(key);
        return null;
      }
      return { data: entry.data, savedAt: entry.savedAt };
    },
    invalidate(key) {
      entries.delete(key);
    },
    invalidateFiles(names) {
      if (!names) {
        globalGeneration += 1;
        fileGenerations.clear();
        entries.clear();
        return;
      }
      names.forEach((name) => fileGenerations.set(name, (fileGenerations.get(name) ?? 0) + 1));
      const invalidated = new Set(names);
      entries.forEach((entry, key) => {
        if (invalidated.has(entry.fileName)) entries.delete(key);
      });
    },
  };
  registeredCaches.add(cache as QuotaFallbackCache<unknown>);
  return cache;
}

/** Invalidates every fallback cache; called wherever the quota store is cleared. */
export function invalidateQuotaFallbackCaches(names?: string[]): void {
  registeredCaches.forEach((cache) => cache.invalidateFiles(names));
}
