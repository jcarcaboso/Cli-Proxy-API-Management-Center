import { describe, expect, test } from 'bun:test';
import { createQuotaFallbackCache, invalidateQuotaFallbackCaches } from '@/utils/quota';
import { MINUTE_MS } from '@/utils/time/durations';

type Data = { windows: { resetAtMs?: number | null }[]; value: number };

const setup = (maxAgeMs = 10 * MINUTE_MS) => {
  let now = 1_000_000;
  const cache = createQuotaFallbackCache<Data>({ maxAgeMs, now: () => now });
  return {
    cache,
    advance: (ms: number) => {
      now += ms;
    },
    at: () => now,
  };
};

describe('quota fallback cache', () => {
  test('serves the last successful snapshot with its timestamp', () => {
    const { cache, at } = setup();
    const data = { windows: [{ resetAtMs: at() + 60 * MINUTE_MS }], value: 1 };
    cache.store('a', 'a.json', data, cache.capture('a.json'));
    expect(cache.read('a')).toEqual({ data, savedAt: at() });
  });

  test('expires snapshots older than the maximum age', () => {
    const { cache, advance } = setup(10 * MINUTE_MS);
    cache.store('a', 'a.json', { windows: [], value: 1 }, cache.capture('a.json'));
    advance(10 * MINUTE_MS);
    expect(cache.read('a')).not.toBeNull();
    advance(1);
    expect(cache.read('a')).toBeNull();
  });

  test('drops a snapshot once any of its windows has reset', () => {
    const { cache, advance, at } = setup();
    const resetAtMs = at() + MINUTE_MS;
    cache.store(
      'a',
      'a.json',
      { windows: [{ resetAtMs: null }, { resetAtMs }], value: 1 },
      cache.capture('a.json')
    );
    advance(MINUTE_MS);
    expect(cache.read('a')).toBeNull();
  });

  test('invalidates by file name and globally', () => {
    const { cache } = setup();
    cache.store('a', 'a.json', { windows: [], value: 1 }, cache.capture('a.json'));
    cache.store('b', 'b.json', { windows: [], value: 2 }, cache.capture('b.json'));
    invalidateQuotaFallbackCaches(['a.json']);
    expect(cache.read('a')).toBeNull();
    expect(cache.read('b')).not.toBeNull();
    invalidateQuotaFallbackCaches();
    expect(cache.read('b')).toBeNull();
  });

  test('ignores a read that was invalidated while it was in flight', () => {
    const { cache } = setup();
    const fileToken = cache.capture('a.json');
    cache.invalidateFiles(['a.json']);
    cache.store('a', 'a.json', { windows: [], value: 1 }, fileToken);
    expect(cache.read('a')).toBeNull();

    const globalToken = cache.capture('a.json');
    cache.invalidateFiles();
    cache.store('a', 'a.json', { windows: [], value: 1 }, globalToken);
    expect(cache.read('a')).toBeNull();
  });
});
