import Link from 'next/link';
import clsx from 'clsx';
import { QuestionMarkCircleIcon } from '@heroicons/react/16/solid';
import GameTicker from '@/app/ui/game/ticker';
import type { PlayStatus } from '@/app/lib/types';
import { getOrdinalSuffix } from '@/app/lib/utils';
import styles from '@/app/ui/board/footer.module.css';

const ReplayIcon = () => {
  return (
    <svg
      stroke='currentColor'
      fill='currentColor'
      strokeWidth='0'
      width='1.5rem'
      height='1.5rem'
      viewBox='0 0 512 512'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M500.33 0h-47.41a12 12 0 0 0-12 12.57l4 82.76A247.42 247.42 0 0 0 256 8C119.34 8 7.9 119.53 8 256.19 8.1 393.07 119.1 504 256 504a247.1 247.1 0 0 0 166.18-63.91 12 12 0 0 0 .48-17.43l-34-34a12 12 0 0 0-16.38-.55A176 176 0 1 1 402.1 157.8l-101.53-4.87a12 12 0 0 0-12.57 12v47.41a12 12 0 0 0 12 12h200.33a12 12 0 0 0 12-12V12a12 12 0 0 0-12-12z'></path>
    </svg>
  );
};

export default function BoardFooter({
  isFirstGame,
  playStatus,
  tries,
  nextGameAt,
  onClick,
}: {
  isFirstGame: boolean;
  playStatus: PlayStatus;
  tries: number;
  nextGameAt: string;
  onClick: () => void;
}) {
  if (playStatus === 'win') {
    return (
      <div className='text-center'>
        <GameTicker nextGameAt={nextGameAt} />
      </div>
    );
  } else if (playStatus === 'initial' && tries) {
    return (
      <div className='text-center font-medium'>
        {tries + 1}
        {getOrdinalSuffix(tries + 1)} try
      </div>
    );
  } else if (playStatus !== 'initial') {
    return (
      <div className='text-center'>
        <button
          className={clsx('icon-btn', styles['replay-btn'])}
          type='button'
          onClick={onClick}
          tabIndex={0}
        >
          <ReplayIcon />
        </button>
      </div>
    );
  }

  if (isFirstGame) {
    return (
      <div className='text-center'>
        <Link className={styles['how-to-play']} href='/about'>
          How to play <QuestionMarkCircleIcon width='1.5rem' height='1.5rem' />
        </Link>
      </div>
    );
  }

  return (
    <div className='text-center font-medium'>
      Go to the red coin, tap the green one to begin.
    </div>
  );
}
