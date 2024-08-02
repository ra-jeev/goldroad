'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from '@/app/ui/game/ticker.module.css';

export default function GameTicker({ nextGameAt }: { nextGameAt: string }) {
  const [timeStr, setTimeStr] = useState('00:00:00');
  const pathName = usePathname();
  const router = useRouter();

  const prepareTimeString = useCallback((timeInSecs: number): string => {
    if (timeInSecs <= 0) return '00:00:00';

    const hrs = Math.floor(timeInSecs / 3600);
    const mins = Math.floor((timeInSecs % 3600) / 60);
    const secs = timeInSecs % 60;

    const prefixedVal = (val: number) => `${val < 10 ? '0' : ''}${val}`;

    return `${prefixedVal(hrs)}:${prefixedVal(mins)}:${prefixedVal(secs)}`;
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (nextGameAt) {
      const nextGameTime = new Date(nextGameAt).getTime();

      const updateTimer = () => {
        const now = Date.now();
        const timeRemainingInSecs = Math.max(
          0,
          Math.floor((nextGameTime - now) / 1000)
        );

        setTimeStr(prepareTimeString(timeRemainingInSecs));

        if (timeRemainingInSecs <= 0) {
          if (timer) clearInterval(timer);
        }
      };

      updateTimer(); // Initial update
      timer = setInterval(updateTimer, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [nextGameAt, prepareTimeString]);

  const isNewGameReady = timeStr === '00:00:00';

  const refreshPage = () => {
    if (pathName !== '/') {
      router.refresh();
    }
  };

  return (
    <div className={styles.ticker}>
      {isNewGameReady ? (
        <>
          <span>New Puzzle Ready</span>
          <span className={styles['ticker-dot']} />
          <Link href='/' onClick={refreshPage}>
            Play now
          </Link>
        </>
      ) : (
        <span>
          New Puzzle In <strong>{timeStr}</strong>
        </span>
      )}
    </div>
  );
}
