import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { countdownParts, formatCountdown } from '@/utils/quota';
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from '@/utils/time/durations';

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key) as unknown as TFunction;
const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);

describe('quota countdown', () => {
  test('splits the remaining time into units', () => {
    expect(
      countdownParts(NOW + 2 * DAY_MS + 3 * HOUR_MS + 4 * MINUTE_MS + 5 * SECOND_MS, NOW)
    ).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  test('rounds partial seconds up so it never undercounts', () => {
    expect(countdownParts(NOW + 1, NOW)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
  });

  test('returns null once the instant has passed', () => {
    expect(countdownParts(NOW, NOW)).toBeNull();
    expect(countdownParts(NOW - SECOND_MS, NOW)).toBeNull();
    expect(countdownParts(Number.NaN, NOW)).toBeNull();
  });

  test('chooses the format by magnitude and pads trailing units', () => {
    expect(formatCountdown(NOW + DAY_MS + 5 * MINUTE_MS, NOW, t)).toBe(
      'quota_management.countdown_days {"days":1,"hours":"00","minutes":"05"}'
    );
    expect(formatCountdown(NOW + 4 * HOUR_MS + 7 * SECOND_MS, NOW, t)).toBe(
      'quota_management.countdown_hours {"hours":4,"minutes":"00","seconds":"07"}'
    );
    expect(formatCountdown(NOW + 12 * MINUTE_MS + 30 * SECOND_MS, NOW, t)).toBe(
      'quota_management.countdown_minutes {"minutes":12,"seconds":"30"}'
    );
    expect(formatCountdown(NOW - MINUTE_MS, NOW, t)).toBe('quota_management.countdown_due');
  });
});
