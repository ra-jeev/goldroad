import { computed } from 'vue';

/**
 * True whenever something is covering the board that the player hasn't
 * dismissed yet (How to Play, first-run tutorial, the v1-returning-player
 * welcome sheet, or the navigation drawer).
 * `useRoadDayGameplay` treats this the same way it treats a hidden document:
 * a reason to withhold/pause the active solve timer, since the player isn't
 * actually looking at — let alone able to click — the real board.
 */
export function useBoardOverlayGate() {
  const { isHowToPlayOpen } = useHowToPlaySheet();
  const { isTutorialOpen } = useTutorialFlow();
  const { showNotice: showV1WelcomeNotice } = useV1ReturningPlayerNotice();
  const { isNavDrawerOpen } = useNavDrawer();

  const isBoardOverlayOpen = computed(
    () =>
      isHowToPlayOpen.value ||
      isTutorialOpen.value ||
      showV1WelcomeNotice.value ||
      isNavDrawerOpen.value,
  );

  return { isBoardOverlayOpen };
}
