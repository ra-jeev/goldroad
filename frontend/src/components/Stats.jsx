import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaShare, FaPlayCircle } from 'react-icons/fa';

import { useRealmApp } from './RealmApp';
import './Stats.css';

const emojis = ['🥇', '🥈', '🥉'];

export const Stats = () => {
  const [user, setUser] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [gameDataLoading, setGameDataLoading] = useState(false);
  const [message, setMessage] = useState(false);
  const realmApp = useRealmApp();

  const solvedTodaysGame =
    gameData &&
    user &&
    user.data.lastGamePlayed &&
    gameData.gameNo === user.data.lastGamePlayed.gameNo &&
    user.data.lastGamePlayed.solved;

  useEffect(() => {
    const getUserData = async () => {
      setUserDataLoading(true);
      const user = await realmApp.client
        ?.db(process.env.REACT_APP_MONGO_DB_NAME)
        ?.collection('users')
        ?.findOne({ _id: realmApp.user.id });
      setUser({ ...user });
      setUserDataLoading(false);
    };

    if (realmApp.client && realmApp.user?.id) {
      getUserData();
    }
  }, [realmApp.client, realmApp.user]);

  useEffect(() => {
    const getGameData = async () => {
      setGameDataLoading(true);
      const resp = await fetch(process.env.REACT_APP_GAME_API_URL);
      if (resp.ok) {
        const gameDoc = await resp.json();

        if (gameDoc) {
          setGameData(gameDoc);
        }
      }

      setGameDataLoading(false);
    };

    getGameData();
  }, []);

  const shareStats = async () => {
    const text = `@TheGoldRoad\nGoldRoad #${gameData.gameNo}\n${
      emojis[user.data.lastGamePlayed.tries - 1] || '👏'
    } ${user.data.lastGamePlayed.tries} ${
      user.data.lastGamePlayed.tries === 1 ? 'try' : 'tries'
    }\n#GoldRoad #GoldRoad${
      gameData.gameNo
    }\n\nPlay now: https://goldroad.web.app`;

    if (window.navigator.share) {
      await window.navigator.share({
        text,
      });
    } else {
      await window.navigator.clipboard.writeText(text);
      setMessage([
        'Result copied to your clipboard.',
        'Paste & share with your friends :-)',
      ]);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [message]);

  return (
    <div className='stats-container'>
      {userDataLoading || gameDataLoading
        ? 'Loading...'
        : user && (
            <>
              <div className='stats-card gap-2'>
                <div className='stats-card-title'>Today's Puzzle</div>
                {solvedTodaysGame ? (
                  <>
                    <div className='stats-congrats'>Yay! You did it 🎉</div>
                    <div className='stats-text'>
                      @TheGoldRoad
                      <br />
                      <br />
                      GoldRoad #{gameData.gameNo}
                      <br />
                      {`${emojis[user.data.lastGamePlayed.tries - 1] || '👏'} ${
                        user.data.lastGamePlayed.tries +
                        (user.data.lastGamePlayed.tries === 1
                          ? ' try'
                          : ' tries')
                      }`}
                      <br />
                      #GoldRoad #GoldRoad{gameData.gameNo}
                      <br />
                      <br />
                      https://goldroad.web.app
                    </div>
                    {message && (
                      <div>
                        {message.map((text, index) => {
                          return (
                            <div
                              className='stats-message'
                              key={`message_${index}`}
                            >
                              {text}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button className='btn' onClick={shareStats}>
                      <FaShare /> Share now
                    </button>
                  </>
                ) : (
                  <>
                    <div>Umm...you haven't solved it yet!</div>
                    <Link className='link' to='/' replace={true}>
                      <button className='btn'>
                        <FaPlayCircle /> Play now
                      </button>
                    </Link>
                  </>
                )}
              </div>
              <div className='stats-card'>
                <div className='stats-card-title'>Your Stats</div>
                <div className='stats-card-item'>
                  <div className='stats-item-key'>Current Streak:</div>
                  <div className='stats-item-val'>
                    {user.data.currStreak}{' '}
                    {user.data.currStreak === 1 ? 'day' : 'days'}
                  </div>
                </div>
                <div className='stats-card-item'>
                  <div className='stats-item-key'>Longest Streak:</div>
                  <div className='stats-item-val'>
                    {user.data.isCurrLongestStreak && '☝️ '}
                    {user.data.longestStreak}{' '}
                    {user.data.longestStreak === 1 ? 'day' : 'days'}
                  </div>
                </div>
                <div className='stats-card-item'>
                  <div className='stats-item-key'>Total Treads:</div>
                  <div className='stats-item-val'>
                    {user.data.played}{' '}
                    {user.data.played === 1 ? 'road' : 'roads'}
                  </div>
                </div>
                <div className='stats-card-item'>
                  <div className='stats-item-key'>Total Treasures:</div>
                  <div className='stats-item-val'>
                    {user.data.solves}{' '}
                    {user.data.solves === 1 ? 'haul' : 'hauls'}
                  </div>
                </div>
              </div>
            </>
          )}
    </div>
  );
};