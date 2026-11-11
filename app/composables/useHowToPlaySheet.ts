export const HOW_TO_PLAY_PATH = '/how-to-play';

/**
 * The How to Play sheet has an address. It is open exactly when the route is
 * `/how-to-play`, a child route of the board page, so the rules can be linked
 * to and indexed while the board stays mounted underneath.
 */
export function useHowToPlaySheet() {
  const route = useRoute();
  const router = useRouter();

  const isHowToPlayOpen = computed(
    () => route.path.replace(/\/+$/, '') === HOW_TO_PLAY_PATH,
  );

  function openHowToPlay() {
    if (isHowToPlayOpen.value) return;
    return navigateTo(HOW_TO_PLAY_PATH);
  }

  /**
   * Opened from inside the app, closing is Back, so the player returns to
   * the page they came from. Landed on directly (a shared link, a search
   * result), there is nothing to go back to, so closing reveals the board.
   */
  function closeHowToPlay() {
    if (!isHowToPlayOpen.value) return;

    if (import.meta.client && window.history.state?.back) {
      router.back();
      return;
    }

    return navigateTo('/', { replace: true });
  }

  return {
    isHowToPlayOpen,
    openHowToPlay,
    closeHowToPlay,
  };
}
