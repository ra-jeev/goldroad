'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { TrophyIcon } from '@heroicons/react/16/solid';
import GamePlayHistory from '@/app/ui/game/play-history';
import type { GameHistory } from '@/app/lib/types';
import styles from '@/app/ui/game/card.module.css';

const CertificateIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 384 512'
      className={className}
    >
      <path
        fill='currentColor'
        d='M97.12 362.63c-8.69-8.69-4.16-6.24-25.12-11.85c-9.51-2.55-17.87-7.45-25.43-13.32L1.2 448.7c-4.39 10.77 3.81 22.47 15.43 22.03l52.69-2.01L105.56 507c8 8.44 22.04 5.81 26.43-4.96l52.05-127.62c-10.84 6.04-22.87 9.58-35.31 9.58c-19.5 0-37.82-7.59-51.61-21.37M382.8 448.7l-45.37-111.24c-7.56 5.88-15.92 10.77-25.43 13.32c-21.07 5.64-16.45 3.18-25.12 11.85c-13.79 13.78-32.12 21.37-51.62 21.37c-12.44 0-24.47-3.55-35.31-9.58L252 502.04c4.39 10.77 18.44 13.4 26.43 4.96l36.25-38.28l52.69 2.01c11.62.44 19.82-11.27 15.43-22.03M263 340c15.28-15.55 17.03-14.21 38.79-20.14c13.89-3.79 24.75-14.84 28.47-28.98c7.48-28.4 5.54-24.97 25.95-45.75c10.17-10.35 14.14-25.44 10.42-39.58c-7.47-28.38-7.48-24.42 0-52.83c3.72-14.14-.25-29.23-10.42-39.58c-20.41-20.78-18.47-17.36-25.95-45.75c-3.72-14.14-14.58-25.19-28.47-28.98c-27.88-7.61-24.52-5.62-44.95-26.41c-10.17-10.35-25-14.4-38.89-10.61c-27.87 7.6-23.98 7.61-51.9 0c-13.89-3.79-28.72.25-38.89 10.61c-20.41 20.78-17.05 18.8-44.94 26.41c-13.89 3.79-24.75 14.84-28.47 28.98c-7.47 28.39-5.54 24.97-25.95 45.75c-10.17 10.35-14.15 25.44-10.42 39.58c7.47 28.36 7.48 24.4 0 52.82c-3.72 14.14.25 29.23 10.42 39.59c20.41 20.78 18.47 17.35 25.95 45.75c3.72 14.14 14.58 25.19 28.47 28.98C104.6 325.96 106.27 325 121 340c13.23 13.47 33.84 15.88 49.74 5.82a39.68 39.68 0 0 1 42.53 0c15.89 10.06 36.5 7.65 49.73-5.82M97.66 175.96c0-53.03 42.24-96.02 94.34-96.02s94.34 42.99 94.34 96.02s-42.24 96.02-94.34 96.02s-94.34-42.99-94.34-96.02'
      />
    </svg>
  );
};

const WalkIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 48 48'
      className={className}
    >
      <g fill='currentColor'>
        <path d='M31.25 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0m-5.557 20.397l5.193 5.124a2 2 0 0 1 .457.693l2.769 7.055a2 2 0 0 1-3.724 1.462l-2.614-6.661l-8.928-8.81a2 2 0 0 1-.583-1.649l.715-6.32c-1.724 1.714-3.054 4.123-4.073 7.316a2 2 0 1 1-3.81-1.216c1.87-5.86 4.975-10.246 10.185-12.257l.023-.009c1.327-.493 2.707-.453 3.937.182c1.181.611 2.022 1.666 2.573 2.848l.648 1.4c.488 1.058.898 1.95 1.293 2.732c.553 1.1.998 1.83 1.438 2.342c.408.474.813.766 1.33.968c.556.217 1.335.367 2.538.403a2 2 0 1 1-.12 3.998c-1.445-.043-2.728-.228-3.873-.675c-1.183-.462-2.116-1.165-2.91-2.09c-.5-.582-.94-1.247-1.35-1.97z' />
        <path d='m18.263 30.22l3.315 3.18l-1.526 5.147a2 2 0 0 1-.684 1.006l-5.134 4.023a2 2 0 0 1-2.467-3.15l4.632-3.628l1.395-4.71z' />
      </g>
    </svg>
  );
};

const NoAward = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='1em'
      height='1em'
      viewBox='0 0 24 24'
      className={className}
    >
      <path
        fill='none'
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76M8 12h8'
      />
    </svg>
  );
};

const GameAward = ({ gameHistory }: { gameHistory: GameHistory }) => {
  if (gameHistory.firstSolved === undefined) {
    return <NoAward className={styles.noAwardIcon} />;
  }

  if (gameHistory.attempts[gameHistory.firstSolved].current) {
    return <TrophyIcon className={styles.trophyIcon} />;
  } else {
    return <CertificateIcon className={styles.certificateIcon} />;
  }
};

const GameCard = ({
  gameNo,
  maxScore,
  gameHistory,
}: {
  gameNo: number;
  maxScore: number;
  gameHistory: GameHistory;
}) => {
  return (
    <div className={clsx('card', styles.gameCard)}>
      <div className={styles.gameDetails}>
        <Link href={`/games/${gameNo}`} className={styles.gameTitle}>
          <GameAward gameHistory={gameHistory} />
          <span>GoldRoad #{gameNo}</span>
        </Link>
        <div className={styles.gameDescription}>
          Collect <strong>{maxScore} coins</strong> in your path
        </div>

        <GamePlayHistory gameNo={gameNo} gameHistory={gameHistory} />
      </div>
      <Link href={`/games/${gameNo}`} className={styles.playButton}>
        <WalkIcon className={styles.playIcon} />
      </Link>
    </div>
  );
};

export default GameCard;
