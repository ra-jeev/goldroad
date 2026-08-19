import { createSharedComposable } from '@vueuse/core';
import { useSound, type ReturnedValue } from '@vueuse/sound';
import { Howler } from 'howler';

type SoundEffectKey = 'move' | 'deny' | 'dead-end' | 'solve' | 'undo';

const SOUND_PATHS: Record<SoundEffectKey, string> = {
  move: '/sounds/move.mp3',
  deny: '/sounds/deny.mp3',
  'dead-end': '/sounds/dead-end.mp3',
  solve: '/sounds/solve.mp3',
  // The step's own clip, pitched down and softened. Volume alone reads as a
  // step that half-registered; dropping the rate is what says "backwards".
  undo: '/sounds/move.mp3',
};

// Howler suspends the AudioContext after 30 seconds without playback. A puzzle
// game is mostly silence between taps, and on iOS an undo of that suspend needs
// a fresh user gesture, so keep the context alive and let Howler decide when to
// resume it.
if (import.meta.client) {
  Howler.autoSuspend = false;
}

function vibrate(pattern: VibratePattern) {
  if (!import.meta.client) return;
  if (!('vibrate' in navigator)) return;

  navigator.vibrate(pattern);
}

function createSoundEffects() {
  const { muted } = useGoldroadLocalState();

  function soundOptions(
    sound: SoundEffectKey,
    extras: { volume?: number; playbackRate?: number } = {},
  ) {
    return {
      html5: false,
      interrupt: true,
      preload: true,
      ...extras,
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
    undo: useSound(
      SOUND_PATHS.undo,
      soundOptions('undo', { volume: 0.55, playbackRate: 0.8 }),
    ),
  };

  /**
   * Hand every play straight to Howler, including while the AudioContext is
   * still suspended or iOS has interrupted it. Howl.play() resumes the context
   * itself and queues the sound until it is running again, and each call site
   * is a `flush: 'sync'` watcher on a tap, so that resume happens inside the
   * user gesture iOS requires. Tracking our own readiness on top of Howler's is
   * what used to silence the game: the two states drifted apart and a stuck
   * flag had no way back to a playable state.
   */
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

  function playUndo() {
    play('undo');
    if (!muted.value) {
      vibrate(8);
    }
  }

  return {
    playMove,
    playDeniedMove,
    playDeadEnd,
    playSolve,
    playUndo,
  };
}

// The persistent layout instantiates this shared instance so board sounds
// begin loading before the first board tap. Howler uses Web Audio when it is
// available and falls back to HTML5 Audio where necessary.
export const useSoundEffects = createSharedComposable(createSoundEffects);
