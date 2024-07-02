'use client';

import { useState, useEffect } from 'react';

export const useGameSounds = () => {
  const getGameSoundsSetting = () => {
    return localStorage.getItem('sounds') || 'on';
  };

  const setGameSoundsSetting = (value: string) => {
    localStorage.setItem('sounds', value);
  };

  const [gameSounds, setGameSounds] = useState<string>();
  useEffect(() => {
    const handleStorageChange = () => {
      setGameSounds(getGameSoundsSetting());
    };

    window.addEventListener('storage', handleStorageChange);
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleSoundsSetting = () => {
    const newValue = gameSounds === 'on' ? 'off' : 'on';
    setGameSoundsSetting(newValue);
  };

  return { gameSounds, toggleSoundsSetting };
};
