export function useHowToPlaySheet() {
  const isHowToPlayOpen = useState<boolean>('how-to-play-open', () => false)

  function openHowToPlay() {
    isHowToPlayOpen.value = true
  }

  function closeHowToPlay() {
    isHowToPlayOpen.value = false
  }

  return {
    isHowToPlayOpen,
    openHowToPlay,
    closeHowToPlay,
  }
}