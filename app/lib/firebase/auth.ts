import {
  signInAnonymously as _signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged as _onAuthStateChanged,
  NextOrObserver,
  User,
  signOut as _signOut,
} from 'firebase/auth';

import { auth } from '@/app/lib/firebase/clientApp';

export function onAuthStateChanged(cb: NextOrObserver<User>) {
  return _onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google', error);
  }
}

export async function signOut() {
  try {
    return _signOut(auth);
  } catch (error) {
    console.error('Error signing out with Google', error);
  }
}

export async function signInAnonymously() {
  try {
    await _signInAnonymously(auth);
  } catch (error) {
    console.error('Error signing in anonymously', error);
  }
}
