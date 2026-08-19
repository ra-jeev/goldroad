/**
 * Open state for the site navigation drawer.
 *
 * Shared rather than local to the layout because the board needs to know:
 * `useBoardOverlayGate` pauses the solve timer while anything covers the
 * board, and a drawer over the board means the player has stopped playing.
 */
export function useNavDrawer() {
  const isNavDrawerOpen = useState<boolean>('nav-drawer-open', () => false);

  function openNavDrawer() {
    isNavDrawerOpen.value = true;
  }

  function closeNavDrawer() {
    isNavDrawerOpen.value = false;
  }

  function toggleNavDrawer() {
    isNavDrawerOpen.value = !isNavDrawerOpen.value;
  }

  return {
    isNavDrawerOpen,
    openNavDrawer,
    closeNavDrawer,
    toggleNavDrawer,
  };
}
