import { Link } from 'react-router-dom';

import { FaQuestionCircle, FaRedo } from 'react-icons/fa';
import { NewGameTicker } from './NewGameTicker';

const datesEqual = (date1, date2, checkUTC = false) => {
  if (typeof date1 !== 'object' && typeof date1.getMonth !== 'function') {
    date1 = new Date(date1);
  }

  if (typeof date2 !== 'object' && typeof date2.getMonth !== 'function') {
    date2 = new Date(date2);
  }

  return checkUTC
    ? date1.getUTCDate() === date2.getUTCDate() &&
        date1.getUTCMonth() === date2.getUTCMonth() &&
        date1.getUTCFullYear() === date2.getUTCFullYear()
    : date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear();
};

const getOrdinal = (n) => {
  return ['st', 'nd', 'rd'][((((n + 90) % 100) - 10) % 10) - 1] || 'th';
};

export const GameFooter = ({
  userData,
  gameState,
  lastGame,
  game,
  onClick,
}) => {
  if (!userData) {
    return <div className='game-item'></div>;
  }

  const lastAttempt = lastGame?.attempts
    ? lastGame.attempts[lastGame.attempts.length - 1]
    : null;
  const date = new Date();

  if (gameState.moves) {
    return (
      <div className='game-item'>
        <button className='redo' type='button' onClick={onClick} tabIndex='0'>
          <FaRedo />
        </button>
      </div>
    );
  }

  if (!userData.data.played) {
    return (
      <div className='game-item status'>
        <Link className='link-normal' to='/about'>
          How to play <FaQuestionCircle />
        </Link>
      </div>
    );
  } else if (
    !lastGame ||
    lastGame.gameNo !== game.gameNo ||
    (lastAttempt &&
      (!datesEqual(date, lastAttempt.playedAt) || lastAttempt.solved))
  ) {
    return (
      <div className='game-item status'>
        Go to the red coin, tap the green one to begin.
      </div>
    );
  }

  if (lastGame.solved || game.nextGameAt < date.toISOString()) {
    return (
      <div className='game-item status'>
        <NewGameTicker nextGameAt={game.nextGameAt} />
      </div>
    );
  } else {
    const tries = lastGame.tries || lastAttempt.tries;
    return (
      <div className='game-item status'>
        {tries + 1}
        {getOrdinal(tries + 1)} try
      </div>
    );
  }
};
