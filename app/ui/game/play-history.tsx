'use client';

import type { GameHistory, GameAttempt } from '@/app/lib/types';
import { formatDate } from '@/app/lib/utils';
import styles from '@/app/ui/game/play-history.module.css';

const BadgeX = ({ className }: { className?: string }) => {
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
        d='M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76M15 9l-6 6m0-6l6 6'
      />
    </svg>
  );
};

const BadgeCheck = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='1em'
      height='1em'
      viewBox='0 0 24 24'
      className={className}
    >
      <g
        fill='none'
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
      >
        <path d='M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76' />
        <path d='m9 12l2 2l4-4' />
      </g>
    </svg>
  );
};

const HistoryItem = ({ attempt }: { attempt: GameAttempt }) => {
  return (
    <div className={styles.playInfo}>
      {attempt.solved ? (
        <BadgeCheck className={styles.solved} />
      ) : (
        <BadgeX className={styles.unsolved} />
      )}
      {attempt.tries === 1 ? ' 1 try' : ` ${attempt.tries} tries`} on{' '}
      {formatDate(attempt.playedAt)}
    </div>
  );
};

export default function GamePlayHistory({
  gameNo,
  gameHistory,
}: {
  gameNo: number;
  gameHistory: GameHistory;
}) {
  if (!gameHistory || gameHistory.attempts.length === 0) return null;

  const { attempts, firstSolved } = gameHistory;

  return (
    <div className={styles.playHistory}>
      {attempts.length === 1 ? (
        <HistoryItem attempt={attempts[0]} />
      ) : (
        <details onClick={(e) => e.stopPropagation()}>
          <summary className={styles.summary}>
            Played {attempts.length} times.{' '}
            {firstSolved !== undefined ? (
              <>First solved on {formatDate(attempts[firstSolved].playedAt)}</>
            ) : (
              <>Unsolved</>
            )}
          </summary>
          <div className={styles.detailsExpand}>
            {attempts.map((attempt, index) => (
              <HistoryItem key={`game-${gameNo}-${index}`} attempt={attempt} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
