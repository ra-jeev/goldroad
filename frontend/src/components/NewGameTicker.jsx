import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

import './NewGameTicker.css';

export const NewGameTicker = ({ nextGameAt }) => {
  const [timeStr, setTimeStr] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    const prepareTimeString = (timeInSecs) => {
      if (timeInSecs <= 0) {
        setTimeStr('00:00:00');
        return;
      }

      const hrs = parseInt(timeInSecs / 3600);
      const mins = parseInt((timeInSecs - hrs * 3600) / 60);
      const secs = timeInSecs - hrs * 3600 - mins * 60;

      const prefixedVal = (val) => `${val < 10 ? '0' : ''}${val}`;

      setTimeStr(
        `${prefixedVal(hrs)}:${prefixedVal(mins)}:${prefixedVal(secs)}`
      );
    };

    if (nextGameAt) {
      const nextGameTime = new Date(nextGameAt);
      timer.current = setInterval(() => {
        const timeRemainingInSecs = parseInt(
          (nextGameTime.getTime() - Date.now()) / 1000
        );

        prepareTimeString(timeRemainingInSecs);
        if (timeRemainingInSecs <= 0) {
          clearInterval(timer.current);
        }

        return () => {
          clearInterval(timer.current);
        };
      }, [1000]);
    } else {
      setTimeStr('00:00:00');
    }
  }, [nextGameAt]);

  return timeStr === '00:00:00' ? (
    <div className='ticker'>
      <span>New Puzzle Ready</span>
      <span className='ticker-dot'></span>
      <Link to='/' reloadDocument>
        Play now
      </Link>
    </div>
  ) : (
    <span>
      New Puzzle In <strong>{timeStr}</strong>
    </span>
  );
};
