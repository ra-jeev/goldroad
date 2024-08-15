'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import styles from '@/app/ui/stats/solve-tries.module.css';
import { getEmojiForTries } from '@/app/lib/utils';

type AttemptStats = {
  [tries: number]: number;
};

export default function SolveTriesStats({
  stats,
  currSolveTries,
}: {
  stats: AttemptStats;
  currSolveTries?: number;
}) {
  const [showSecondRow, setShowSecondRow] = useState(false);
  const [incrementIndex, setIncrementIndex] = useState(-1);
  const [showIncrement, setShowIncrement] = useState(false);
  const [animateIncrement, setAnimateIncrement] = useState(false);

  useEffect(() => {
    if (currSolveTries === undefined) return;

    let index;
    if (currSolveTries <= 3) index = currSolveTries - 1;
    else if (currSolveTries < 10) index = 3;
    else if (currSolveTries < 20) index = 4;
    else index = 5;

    setIncrementIndex(index);

    if (index < 3 || (showSecondRow && !showIncrement)) {
      setAnimateIncrement(true);
      const timer = setTimeout(() => {
        setAnimateIncrement(false);
        setShowIncrement(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [currSolveTries, showSecondRow, showIncrement]);

  const categorizeStats = (stats: AttemptStats) => {
    const categories = {
      1: 0,
      2: 0,
      3: 0,
      '4+': 0,
      '10+': 0,
      '20+': 0,
    };

    Object.entries(stats).forEach(([tries, count]) => {
      const numTries = Number(tries);
      if (numTries === 1) categories[1] = count;
      else if (numTries === 2) categories[2] = count;
      else if (numTries === 3) categories[3] = count;
      else if (numTries < 10) categories['4+'] += count;
      else if (numTries < 20) categories['10+'] += count;
      else categories['20+'] += count;
    });

    return categories;
  };

  const categorizedStats = categorizeStats(stats);

  const renderCard = (
    category: string | number,
    count: number,
    index: number
  ) => (
    <div key={category} className='card stats-card'>
      <div className={styles.statsHeader}>
        <span className='emoji-big'>{getEmojiForTries(category)}</span>
        <span className={styles.statsCount}>x {count}</span>
      </div>
      <span className={styles.statsTries}>
        {category} {category === 1 ? 'try' : 'tries'}
      </span>
      {index === incrementIndex && (
        <span
          className={clsx(
            styles.statsIncrement,
            animateIncrement && styles.animateIncrement,
            showIncrement && styles.showIncrement
          )}
        >
          +1
        </span>
      )}
    </div>
  );

  return (
    <div>
      <div className={styles.statsRow}>
        {Object.entries(categorizedStats)
          .slice(0, 3)
          .map(([category, count], index) =>
            renderCard(category, count, index)
          )}
      </div>
      {showSecondRow && (
        <div className={styles.statsRow}>
          {Object.entries(categorizedStats)
            .slice(3)
            .map(([category, count], index) =>
              renderCard(category, count, 3 + index)
            )}
        </div>
      )}
      <button
        className={styles.toggleBtn}
        onClick={() => setShowSecondRow(!showSecondRow)}
      >
        {showSecondRow ? '▲ Hide' : '▼ Show more'}
      </button>
    </div>
  );
}
