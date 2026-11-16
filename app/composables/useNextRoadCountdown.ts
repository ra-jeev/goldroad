import { onMounted, onUnmounted, ref, watch } from 'vue';

/**
 * Live HH:MM:SS countdown to the next road (00:00 UTC rotation).
 * Starts ticking on mount, cleans up on unmount.
 *
 * When `getAnchor` is provided (the live page passes the loaded road's
 * `nextGameAt`), the target comes from the road's own schedule. In that
 * case `cutoffReached` signals the scheduled cutoff.
 *
 * Without an anchor (the stats page), the target is the next wall-clock UTC
 * midnight, fixed at mount so the ready state sticks instead of silently
 * rolling into the following day.
 */
export function useNextRoadCountdown(
  getAnchor?: () => string | null | undefined,
) {
  const countdown = ref('00:00:00');
  const cutoffReached = ref(false);
  let fallbackTargetMs: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function getNextUtcMidnightMs(): number {
    const now = new Date();
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
    );
  }

  function resolveTargetMs(): number {
    const anchor = getAnchor?.();
    if (anchor) {
      const parsed = Date.parse(anchor);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (fallbackTargetMs === null) fallbackTargetMs = getNextUtcMidnightMs();
    return fallbackTargetMs;
  }

  function update() {
    const diff = Math.max(0, resolveTargetMs() - Date.now());
    cutoffReached.value = diff === 0;
    if (diff === 0) {
      countdown.value = '00:00:00';
      return;
    }
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    countdown.value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
  }

  onMounted(() => {
    update();
    if (getAnchor) watch(getAnchor, update, { flush: 'sync' });
    timer = setInterval(update, 1000);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  return { countdown, cutoffReached };
}
