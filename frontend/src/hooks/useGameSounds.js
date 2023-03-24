import { useState } from 'react';

import coin from '../assets/audio/coin.mp3';
import deny from '../assets/audio/deny.mp3';
import noMoves from '../assets/audio/no-moves.mp3';
import win from '../assets/audio/win.mp3';
import okay from '../assets/audio/okay.mp3';

const gameSounds = {
  coin: { src: coin, buffer: null },
  deny: { src: deny, buffer: null },
  noMoves: { src: noMoves, buffer: null },
  win: { src: win, buffer: null },
  okay: { src: okay, buffer: null },
};

export const GAME_SOUNDS = {
  COIN: 'coin',
  DENY: 'deny',
  NO_MOVES: 'noMoves',
  WIN: 'win',
  OKAY: 'okay',
};

let audioCache = null;
const fetchAudioSrc = async (audioSrcUrl) => {
  if (!audioCache) {
    audioCache = await window.caches.open('audio-cache');
  }

  // Check first if audio is in the cache.
  const cacheResponse = await audioCache.match(audioSrcUrl);

  // Let's return cached response if video is already in the cache.
  if (cacheResponse) {
    return cacheResponse;
  }

  // Otherwise, fetch the audio from the network.
  const nwkResponse = await fetch(audioSrcUrl);
  audioCache.put(audioSrcUrl, nwkResponse.clone());
  return nwkResponse;
};

const downloadSounds = async () => {
  await Promise.all(
    Object.values(gameSounds).map((gameSound) => fetchAudioSrc(gameSound.src))
  );
};

downloadSounds();

export const useGameSounds = () => {
  const [audioCtx, setAudioCtx] = useState(null);

  const playSound = async (soundsSetting, sound) => {
    if (soundsSetting !== 'on') {
      return;
    }

    let ctx = audioCtx;
    if (!ctx) {
      ctx = new AudioContext();
      setAudioCtx(ctx);
    }

    const newSound = gameSounds[sound];

    // First create the buffer source else the first sound won't play
    const mSource = ctx.createBufferSource();
    if (!newSound.buffer) {
      const response = await fetchAudioSrc(newSound.src);
      const data = await response.arrayBuffer();
      newSound.buffer = await ctx.decodeAudioData(data);
    }

    mSource.buffer = newSound.buffer;
    mSource.connect(ctx.destination);
    mSource.start();
  };

  return { playSound };
};
