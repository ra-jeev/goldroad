type SoundEffectKey = 'move' | 'deny' | 'dead-end' | 'solve';

const SOUND_PATHS: Record<SoundEffectKey, string> = {
  move: '/sounds/move.mp3',
  deny: '/sounds/deny.mp3',
  'dead-end': '/sounds/dead-end.mp3',
  solve: '/sounds/solve.mp3',
};

const audioElements = new Map<SoundEffectKey, HTMLAudioElement>();

function getAudioElement(sound: SoundEffectKey): HTMLAudioElement | null {
  if (!import.meta.client) return null;

  const existing = audioElements.get(sound);
  if (existing) return existing;

  const audio = new Audio(SOUND_PATHS[sound]);
  audio.preload = 'auto';
  audioElements.set(sound, audio);
  return audio;
}

function vibrate(pattern: VibratePattern) {
  if (!import.meta.client) return;
  if (!('vibrate' in navigator)) return;

  navigator.vibrate(pattern);
}

export function useSoundEffects() {
  const { muted } = useGoldroadLocalState();

  function play(sound: SoundEffectKey) {
    if (muted.value) return;

    const audio = getAudioElement(sound);
    if (!audio) return;

    audio.currentTime = 0;
    void audio.play();
  }

  function playMove() {
    play('move');
    if (!muted.value) {
      vibrate(12);
    }
  }

  function playDeniedMove() {
    play('deny');
  }

  function playDeadEnd() {
    play('dead-end');
  }

  function playSolve() {
    play('solve');
    if (!muted.value) {
      vibrate([18, 28, 18]);
    }
  }

  return {
    playMove,
    playDeniedMove,
    playDeadEnd,
    playSolve,
  };
}
