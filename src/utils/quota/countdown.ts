/**
 * Live countdown to a known reset instant, e.g. `4h 12m 05s`.
 *
 * The relative label ("in 4 hours") truncates to its coarsest unit, which is
 * fine for planning but hides the minutes that matter once a window is close
 * to resetting. Providers that report an exact reset instant (Claude) can show
 * the precise remaining time instead.
 *
 * Pure and clock-free: `nowMs` is passed in, and the caller decides how often
 * it ticks (see `SECOND_CLOCK`).
 */

import type { TFunction } from 'i18next';
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from '@/utils/time/durations';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Remaining time split into units, or null once the instant has passed. */
export function countdownParts(targetMs: number, nowMs: number): CountdownParts | null {
  const remaining = targetMs - nowMs;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  // Rounded up to whole seconds so the label never claims less time than
  // remains and reaches zero exactly at the reset instant.
  const total = Math.ceil(remaining / SECOND_MS) * SECOND_MS;
  return {
    days: Math.floor(total / DAY_MS),
    hours: Math.floor((total % DAY_MS) / HOUR_MS),
    minutes: Math.floor((total % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((total % MINUTE_MS) / SECOND_MS),
  };
}

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Localized compact countdown. Days drop the seconds (they would only add
 * noise); under an hour drops the hours. A passed instant reads as "due"
 * until the next refresh replaces it.
 */
export function formatCountdown(targetMs: number, nowMs: number, t: TFunction): string {
  const parts = countdownParts(targetMs, nowMs);
  if (!parts) return t('quota_management.countdown_due');
  const { days, hours, minutes, seconds } = parts;
  if (days > 0) {
    return t('quota_management.countdown_days', { days, hours: pad(hours), minutes: pad(minutes) });
  }
  if (hours > 0) {
    return t('quota_management.countdown_hours', {
      hours,
      minutes: pad(minutes),
      seconds: pad(seconds),
    });
  }
  return t('quota_management.countdown_minutes', { minutes, seconds: pad(seconds) });
}
