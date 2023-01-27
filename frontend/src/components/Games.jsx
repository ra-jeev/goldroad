import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaAward, FaPlayCircle, FaTrophy } from 'react-icons/fa';
import { FiCheckSquare, FiXSquare } from 'react-icons/fi';

import { useAppData } from './AppData';
import './Games.css';

let dateFormatter;
const formatDate = (date) => {
  if (!date) {
    return '';
  }

  if (!dateFormatter) {
    dateFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return dateFormatter.format(date);
};

export const Games = () => {
  const [fetchOffset, setFetchOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { getPastGames, getUserGamesHistory, pastGames, userGames } =
    useAppData();

  useEffect(() => {
    const getGames = async () => {
      setLoading(true);

      await getPastGames(fetchOffset);

      setLoading(false);
    };

    getGames();
  }, [fetchOffset, getPastGames]);

  useEffect(() => {
    const getHistory = async () => {
      await getUserGamesHistory(
        pastGames[fetchOffset].gameNo,
        pastGames[pastGames.length - 1].gameNo
      );
    };

    if (pastGames && pastGames.length && pastGames.length > fetchOffset) {
      getHistory();
    }
  }, [fetchOffset, pastGames, getUserGamesHistory]);

  const getTrophy = (gameNo) => {
    if (
      userGames &&
      userGames[gameNo] &&
      userGames[gameNo].firstSolved !== undefined
    ) {
      const gameHistory = userGames[gameNo];

      if (gameHistory.attempts[gameHistory.firstSolved].current) {
        return <FaTrophy className='trophy trophy-gold' />;
      } else {
        return <FaAward className='trophy trophy-silver' />;
      }
    }
  };

  const getPluralTry = (tryCount) => {
    let suffix = 'try';
    if (tryCount !== 1) {
      suffix = 'tries';
    }

    return `${tryCount} ${suffix}`;
  };

  const getHistoryItem = (attempt) => {
    return (
      <>
        {attempt.solved ? (
          <FiCheckSquare className='solved-icon' />
        ) : (
          <FiXSquare className='unsolved-icon' />
        )}
        {getPluralTry(attempt.tries)} on {formatDate(attempt.playedAt)}
      </>
    );
  };

  const getPlayHistory = (gameNo) => {
    if (userGames && userGames[gameNo]) {
      const gameHistory = userGames[gameNo];

      return (
        <div className='play-history'>
          {gameHistory.attempts.length === 1 ? (
            <div className='play-info'>
              {getHistoryItem(gameHistory.attempts[0])}
            </div>
          ) : (
            <details>
              <summary>
                Played {gameHistory.attempts.length} times.{' '}
                {gameHistory.firstSolved !== undefined ? (
                  <>
                    First solved on{' '}
                    {formatDate(
                      gameHistory.attempts[gameHistory.firstSolved].playedAt
                    )}
                  </>
                ) : (
                  <>Unsolved</>
                )}
              </summary>
              <div className='details-expand'>
                {gameHistory.attempts.map((attempt, index) => {
                  return (
                    <div
                      key={`game-${gameHistory.gameNo}-${index}`}
                      className='play-info'
                    >
                      {getHistoryItem(attempt)}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      );
    }
  };

  return (
    <div className='games-container'>
      <div className='games-title'>Roads of past</div>
      <div className='trophy-container'>
        <div className='trophy-card'>
          <FaTrophy className='trophy trophy-gold' />
          Solve on D-day
        </div>
        <div className='trophy-card'>
          <FaAward className='trophy trophy-silver' />
          Solve after D-day
        </div>
      </div>
      <div className='trophy-description'>* D-day = Game of the day</div>
      {pastGames.map((game) => {
        return (
          <div className='game-card' key={game._id}>
            <FaPlayCircle
              className='game-card__button'
              onClick={() => navigate(`/games/${game.gameNo}`)}
            />
            <div className='game-card__details'>
              <div
                className='game-card__title'
                onClick={() => navigate(`/games/${game.gameNo}`)}
              >
                GoldRoad #{game.gameNo}
              </div>
              <div className='game-card__description'>
                Collect <strong>{game.maxScore} coins</strong> in your path
              </div>
              {getPlayHistory(game.gameNo)}
            </div>

            {getTrophy(game.gameNo)}
          </div>
        );
      })}

      {loading ? (
        <div className='games-loading'>Loading...</div>
      ) : (
        pastGames.length &&
        pastGames[pastGames.length - 1].gameNo !== 1 && (
          <button
            className='load-button'
            onClick={() => setFetchOffset(pastGames.length)}
          >
            Load more
          </button>
        )
      )}
    </div>
  );
};
