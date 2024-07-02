'use client';

import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/16/solid';
import { useGameSounds } from '@/app/hooks/useGameSounds';

export default function SoundBtn() {
  const { gameSounds, toggleSoundsSetting } = useGameSounds();

  return (
    <>
      {gameSounds === 'on' ? (
        <SpeakerWaveIcon className='icon-btn' onClick={toggleSoundsSetting} />
      ) : (
        <SpeakerXMarkIcon className='icon-btn' onClick={toggleSoundsSetting} />
      )}
    </>
  );
}
