import { createSharedComposable } from '@vueuse/core';
import { useSound, type ReturnedValue } from '@vueuse/sound';
import { Howler } from 'howler';

type SoundEffectKey = 'move' | 'deny' | 'dead-end' | 'solve';
type RecoverableAudioContextState = AudioContextState | 'interrupted';

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
  const ready = ref(false);
  let initialized = false;
  let hasEligibleGesture = false;
  let unlockPromise: Promise<void> | null = null;
  let recoveryGeneration = 0;
  let pendingSound: SoundEffectKey | null = null;
  const retryBudget = new Map<SoundEffectKey, number>();

  function markReady() {
    ready.value = Howler.ctx?.state === 'running';
    if (!ready.value || muted.value || !pendingSound) return;
    const sound = pendingSound;
    pendingSound = null;
    sounds[sound].play();
  }

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
        if (muted.value || (retryBudget.get(sound) ?? 0) <= 0) return;
        retryBudget.set(sound, 0);
        pendingSound = sound;
        ready.value = false;
        void unlockAudio();
      },
      onunlock: markReady,
    };
  }

  const sounds: Record<SoundEffectKey, ReturnedValue> = {
    move: useSound(SOUND_PATHS.move, soundOptions('move')),
    deny: useSound(SOUND_PATHS.deny, soundOptions('deny')),
    'dead-end': useSound(SOUND_PATHS['dead-end'], soundOptions('dead-end')),
    solve: useSound(SOUND_PATHS.solve, soundOptions('solve')),
  };

  function reloadSoundBank() {
    for (const [key, sound] of Object.entries(sounds) as Array<
      [SoundEffectKey, ReturnedValue]
    >) {
      try {
        if (sound.sound.value?.state() !== 'loaded') {
          sound.sound.value?.load();
        }
      } catch (error) {
        console.warn(`Could not reload the ${key} sound.`, error);
      }
    }
  }

  function audioContextState(): RecoverableAudioContextState | undefined {
    return Howler.ctx?.state as RecoverableAudioContextState | undefined;
  }

  function recreateClosedAudioContext() {
    if (audioContextState() !== 'closed') return;
    Howler.unload();
    reloadSoundBank();
  }

  async function unlockAudio() {
    if (!import.meta.client || !hasEligibleGesture) return;
    if (unlockPromise) return unlockPromise;

    const generation = recoveryGeneration;
    const attempt = (async () => {
      try {
        recreateClosedAudioContext();
        reloadSoundBank();
        const state = audioContextState();
        if (Howler.ctx && state !== 'running' && state !== 'closed') {
          await Howler.ctx.resume();
        }
        if (generation !== recoveryGeneration) return;
        markReady();
      } catch (error) {
        if (generation !== recoveryGeneration) return;
        ready.value = false;
        console.warn('Could not ready the game audio context.', error);
      }
    })();
    unlockPromise = attempt;
    void attempt.finally(() => {
      if (unlockPromise === attempt) unlockPromise = null;
    });

    return attempt;
  }

  function onEligibleGesture() {
    hasEligibleGesture = true;
    void unlockAudio();
  }

  function recoverAudio() {
    // iOS may leave resume() pending indefinitely when it is called from a
    // foreground lifecycle event rather than a fresh user gesture. Invalidate
    // any old attempt and let the next pointer/touch/key gesture perform the
    // actual resume inside its event handler.
    recoveryGeneration += 1;
    unlockPromise = null;
    hasEligibleGesture = false;
    ready.value = false;
    recreateClosedAudioContext();
    reloadSoundBank();
  }

  function initialize() {
    if (!import.meta.client || initialized) return;
    initialized = true;
    window.addEventListener('pointerdown', onEligibleGesture, {
      capture: true,
      passive: true,
    });
    window.addEventListener('touchend', onEligibleGesture, {
      capture: true,
      passive: true,
    });
    window.addEventListener('keydown', onEligibleGesture, { capture: true });
    window.addEventListener('pageshow', recoverAudio);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        recoveryGeneration += 1;
        unlockPromise = null;
        hasEligibleGesture = false;
        ready.value = false;
        return;
      }
      if (document.visibilityState === 'visible') recoverAudio();
    });
    reloadSoundBank();
  }

  function play(sound: SoundEffectKey) {
    if (muted.value) return;
    retryBudget.set(sound, 1);
    if (!ready.value || audioContextState() !== 'running') {
      ready.value = false;
      pendingSound ??= sound;
      // After a lifecycle recovery, hasEligibleGesture is false. This call
      // may queue audio from any source, but only a fresh capture-phase
      // pointer/touch/key handler is allowed to start WebKit's resume().
      void unlockAudio();
      return;
    }
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
    ready,
    initialize,
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
