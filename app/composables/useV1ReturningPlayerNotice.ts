/**
 * Detects whether this browser likely played the original (pre-rewrite)
 * GoldRoad, so a one-time notice can point returning players at the About
 * page's Updates entry explaining the fresh start.
 *
 * v1 never wrote any reliably-present localStorage/sessionStorage key (every
 * one it did write depended on the player taking some specific action, e.g.
 * muting sound or granting push permission), so detection instead checks two
 * signals v1 produced unconditionally on every visit to the game board:
 *
 *   - a Cache Storage bucket named "audio-cache", opened and populated by
 *     v1's sound-effects hook on module load, regardless of the mute setting
 *   - a Firebase Auth session persisted in IndexedDB (database
 *     "firebaseLocalStorageDb"), since v1 auto-signed in every visitor
 *     anonymously
 *
 * Both are origin-scoped, so they only resolve true when v2 is served from
 * the same origin v1 ran on.
 */

const V1_AUDIO_CACHE_NAME = 'audio-cache';
const V1_FIREBASE_INDEXEDDB_NAME = 'firebaseLocalStorageDb';

async function hasV1AudioCache(): Promise<boolean> {
  try {
    if (!('caches' in window)) return false;
    const keys = await window.caches.keys();
    return keys.includes(V1_AUDIO_CACHE_NAME);
  } catch {
    return false;
  }
}

async function hasV1FirebaseSession(): Promise<boolean> {
  try {
    if (!('indexedDB' in window) || typeof window.indexedDB.databases !== 'function') {
      return false;
    }
    const databases = await window.indexedDB.databases();
    return databases.some((db) => db.name === V1_FIREBASE_INDEXEDDB_NAME);
  } catch {
    return false;
  }
}

async function detectV1Player(): Promise<boolean> {
  const [audioCache, firebaseSession] = await Promise.all([
    hasV1AudioCache(),
    hasV1FirebaseSession(),
  ]);

  return audioCache || firebaseSession;
}

export function useV1ReturningPlayerNotice() {
  const localState = useGoldroadLocalState();
  const detectedV1Player = useState('v1-returning-player-detected', () => false);
  const checked = useState('v1-returning-player-checked', () => false);

  async function check() {
    if (!import.meta.client || checked.value) return;
    checked.value = true;
    detectedV1Player.value = await detectV1Player();
  }

  const showNotice = computed(
    () => detectedV1Player.value && !localState.hasDismissedV1Notice.value,
  );

  function dismissNotice() {
    localState.dismissV1Notice();
  }

  return {
    showNotice,
    check,
    dismissNotice,
  };
}
