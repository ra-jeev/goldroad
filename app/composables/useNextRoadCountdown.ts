import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Live HH:MM:SS countdown to the next road (00:00 UTC rotation).
 * Starts ticking on mount, cleans up on unmount.
 *
 * The target midnight is anchored once (and re-anchored via `reset()`), so
 * when it passes, `newRoadReady` flips true and stays true instead of the
 * countdown silently restarting for the following day. The page that owns
 * the countdown calls `reset()` after it has actually loaded the new road.
 */
export function useNextRoadCountdown() {
  const countdown = ref('00:00:00');
  const newRoadReady = ref(false);
  let targetMs: number | null = null;
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

  function update() {
    if (targetMs === null) targetMs = getNextUtcMidnightMs();
    const diff = Math.max(0, targetMs - Date.now());
    if (diff === 0) {
      newRoadReady.value = true;
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

  function reset() {
    targetMs = getNextUtcMidnightMs();
    newRoadReady.value = false;
    update();
  }

  onMounted(() => {
    update();
    timer = setInterval(update, 1000);
  });

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  return { countdown, newRoadReady, reset };
}
