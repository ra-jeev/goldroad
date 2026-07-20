import { createSharedComposable } from '@vueuse/core';
import { useSound, type ReturnedValue } from '@vueuse/sound';

type SoundEffectKey = 'move' | 'deny' | 'dead-end' | 'solve';

const SOUND_PATHS: Record<SoundEffectKey, string> = {
  move: '/sounds/move.mp3',
  deny: '/sounds/deny.mp3',
  'dead-end': '/sounds/dead-end.mp3',
  solve: '/sounds/solve.mp3',
};

function vibrate(pattern: VibratePattern) {
  if (!import.meta.client) return;
  if (!('vibrate' in navigator)) return;

  navigator.vibrate(pattern);
}

function createSoundEffects() {
  const { muted } = useGoldroadLocalState();

  function soundOptions(sound: SoundEffectKey) {
    return {
      html5: false,
      interrupt: true,
      preload: true,
      onloaderror: (_soundId: number, error: unknown) => {
        console.warn(`Could not preload the ${sound} sound.`, error);
      },
      onplayerror: (_soundId: number, error: unknown) => {
        console.warn(`Could not play the ${sound} sound.`, error);
      },
    };
  }

  const sounds: Record<SoundEffectKey, ReturnedValue> = {
    move: useSound(SOUND_PATHS.move, soundOptions('move')),
    deny: useSound(SOUND_PATHS.deny, soundOptions('deny')),
    'dead-end': useSound(SOUND_PATHS['dead-end'], soundOptions('dead-end')),
    solve: useSound(SOUND_PATHS.solve, soundOptions('solve')),
  };

  function play(sound: SoundEffectKey) {
    if (muted.value) return;
    sounds[sound].play();
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

// The persistent layout initializes this shared instance so all four sounds
// begin loading before the first board tap. Howler uses Web Audio when it is
// available and falls back to HTML5 Audio where necessary.
export const useSoundEffects = createSharedComposable(createSoundEffects);
