import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Live HH:MM:SS countdown to the next road (00:00 UTC rotation).
 * Starts ticking on mount, cleans up on unmount.
 */
export function useNextRoadCountdown() {
  const countdown = ref('00:00:00');
  let timer: ReturnType<typeof setInterval> | null = null;

  function getNextUtcMidnight(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
      ),
    );
  }

  function update() {
    const diff = Math.max(0, getNextUtcMidnight().getTime() - Date.now());
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    countdown.value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
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

  return { countdown };
}
