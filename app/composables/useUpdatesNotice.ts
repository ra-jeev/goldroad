import { computed } from 'vue';
import { UPDATES } from '../content/updates';

/**
 * Drives the quiet nav notification dot for the About → Updates entry.
 * General-purpose: applies to every player, not just returning v1 players.
 * Mirrors v1's own `Toolbar.jsx` LAST_UPDATE pattern — compare the newest
 * update's id against what this browser last acknowledged, show a dot if
 * they differ, clear it once the player visits /about.
 */
export function useUpdatesNotice() {
  const localState = useGoldroadLocalState();

  const latestUpdateId = computed(() => UPDATES[0]?.date ?? null);

  const hasUnseenUpdate = computed(() => {
    const latest = latestUpdateId.value;
    if (!latest) return false;
    return localState.lastAcknowledgedUpdateId.value !== latest;
  });

  function acknowledgeLatestUpdate() {
    const latest = latestUpdateId.value;
    if (!latest) return;
    localState.acknowledgeUpdate(latest);
  }

  return {
    hasUnseenUpdate,
    acknowledgeLatestUpdate,
  };
}
