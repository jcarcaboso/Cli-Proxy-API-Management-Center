/**
 * Claude 额度渲染体：套餐/额外用量 chip 行 + 用量窗口水位条。
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClaudeQuotaState } from '@/types';
import { buildResetDisplay, formatCountdown } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { SECOND_CLOCK } from '@/utils/time/sharedClock';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';

export function ClaudeQuotaBody({ quota, classes }: QuotaBodyProps<ClaudeQuotaState>) {
  const { t, i18n } = useTranslation();
  // Claude reports exact reset instants, so each row carries a live countdown.
  const now = useNow(true, SECOND_CLOCK);
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('claude', quota), now),
    [quota, now]
  );
  const windows = quota.windows ?? [];
  const extraUsage = quota.extraUsage ?? null;
  const planType = quota.planType ?? null;

  return (
    <>
      {planType && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('claude_quota.plan_label')}</span>
          <span className={classes.codexPlanValue}>{t(`claude_quota.${planType}`)}</span>
        </div>
      )}
      {extraUsage && extraUsage.is_enabled && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('claude_quota.extra_usage_label')}</span>
          <span className={classes.codexPlanValue}>
            {`$${(extraUsage.used_credits / 100).toFixed(2)} / $${(extraUsage.monthly_limit / 100).toFixed(2)}`}
          </span>
        </div>
      )}
      {windows.length === 0 ? (
        <div className={classes.quotaMessage}>{t('claude_quota.empty_windows')}</div>
      ) : (
        windows.map((window, index) => {
          const used = window.usedPercent;
          const clampedUsed = used === null ? null : Math.max(0, Math.min(100, used));
          const remaining =
            clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
          const percentLabel = remaining === null ? '--' : `${Math.round(remaining)}%`;
          const windowLabel = window.labelKey ? t(window.labelKey) : window.label;
          const baseResetDisplay = buildResetDisplay(
            window.resetLabel,
            window.resetAtMs,
            now,
            i18n.resolvedLanguage
          );
          const resetAtMs = window.resetAtMs;
          const resetDisplay =
            baseResetDisplay && typeof resetAtMs === 'number' && Number.isFinite(resetAtMs)
              ? { ...baseResetDisplay, relative: formatCountdown(resetAtMs, now, t) }
              : baseResetDisplay;

          const soon = window.id === soonestRowId;

          return (
            <div
              key={window.id}
              className={classes.quotaRow}
              title={soon ? t('quota_management.soonest_row_hint') : undefined}
            >
              <div className={classes.quotaRowHeader}>
                <span className={classes.quotaModel}>{windowLabel}</span>
                <div className={classes.quotaMeta}>
                  <span className={classes.quotaPercent}>{percentLabel}</span>
                  {resetDisplay && (
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />
                  )}
                </div>
              </div>
              <QuotaMeter percent={remaining} classes={classes} index={index} />
            </div>
          );
        })
      )}
    </>
  );
}
