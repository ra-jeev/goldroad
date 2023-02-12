import { useEffect, useState, useRef } from 'react';

export const NewGameTicker = ({ nextGameAt }) => {
  const [timeStr, setTimeStr] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    const prepareTimeString = (timeInSecs) => {
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
      const timeRemainingInSecs = parseInt(
        (nextGameTime.getTime() - Date.now()) / 1000
      );
      if (timeRemainingInSecs > 0) {
        prepareTimeString(timeRemainingInSecs);

        timer.current = setInterval(
          (timeRemaining) => {
            prepareTimeString(timeRemaining.secs);
            if (timeRemaining.secs > 0) {
              timeRemaining.secs -= 1;
            } else {
              clearInterval(timer.current);
            }
          },
          1000,
          { secs: timeRemainingInSecs }
        );

        return () => {
          clearInterval(timer.current);
        };
      } else {
        setTimeStr('00:00:00');
      }
    }
  }, [nextGameAt]);

  return (
    <span>
      New Puzzle In: <strong>{timeStr}</strong>
    </span>
  );
};
