export function useTutorialFlow() {
  const isTutorialOpen = useState<boolean>('tutorial-open', () => false);
  const localState = useGoldroadLocalState();

  function openTutorial() {
    isTutorialOpen.value = true;
    localState.markTutorialSeen();
  }

  function closeTutorial() {
    isTutorialOpen.value = false;
  }

  function completeTutorial() {
    localState.markTutorialCompleted();
  }

  return {
    isTutorialOpen,
    openTutorial,
    closeTutorial,
    completeTutorial,
  };
}
