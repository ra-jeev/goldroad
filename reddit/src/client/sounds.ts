// Board sounds. The same clips and the same moments as the website
// (app/composables/useSoundEffects.ts), on plain Web Audio: the website's
// version needs Nuxt and Howler, and four short clips do not.
import { ref, watch } from 'vue';
import moveUrl from '#game/public/sounds/move.mp3';
import denyUrl from '#game/public/sounds/deny.mp3';
import deadEndUrl from '#game/public/sounds/dead-end.mp3';
import solveUrl from '#game/public/sounds/solve.mp3';

type Clip = 'move' | 'deny' | 'dead-end' | 'solve';
type Sound = Clip | 'undo';

const URLS: Record<Clip, string> = { move: moveUrl, deny: denyUrl, 'dead-end': deadEndUrl, solve: solveUrl };

// Undo is the step's own clip, pitched down and softer, as on the website.
const PLAY: Record<Sound, { clip: Clip; volume: number; rate: number }> = {
  move: { clip: 'move', volume: 1, rate: 1 },
  deny: { clip: 'deny', volume: 1, rate: 1 },
  'dead-end': { clip: 'dead-end', volume: 1, rate: 1 },
  solve: { clip: 'solve', volume: 1, rate: 1 },
  undo: { clip: 'move', volume: 0.55, rate: 0.8 },
};

const VIBRATE: Partial<Record<Sound, VibratePattern>> = { move: 12, solve: [18, 28, 18], undo: 8 };

// Mute is a choice on this device only, so local storage is enough.
const MUTE_KEY = 'goldroad:muted';
function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const muted = ref(readMuted());
watch(muted, (value) => {
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked. Mute still works for this visit.
  }
});

let audio: AudioContext | null = null;
const buffers = new Map<Clip, AudioBuffer>();

/**
 * Load the clips before the first tap. A new AudioContext starts suspended
 * until a tap; play() resumes it inside that tap.
 */
export function preloadSounds() {
  if (audio || typeof AudioContext === 'undefined') return;
  audio = new AudioContext();
  const context = audio;
  for (const clip of Object.keys(URLS) as Clip[]) {
    fetch(URLS[clip])
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => buffers.set(clip, buffer))
      .catch((cause) => console.warn(`Could not load the ${clip} sound.`, cause));
  }
}

export function playSound(sound: Sound) {
  if (muted.value) return;
  const pattern = VIBRATE[sound];
  if (pattern && 'vibrate' in navigator) navigator.vibrate(pattern);

  preloadSounds();
  const { clip, volume, rate } = PLAY[sound];
  const buffer = buffers.get(clip);
  if (!audio || !buffer) return;
  if (audio.state !== 'running') void audio.resume();

  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = audio.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(audio.destination);
  source.start();
}
