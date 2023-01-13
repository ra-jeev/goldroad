import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaShare, FaPlayCircle } from 'react-icons/fa';

import { useRealmApp } from './RealmApp';
import { NewGameTicker } from './NewGameTicker';
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
      if (user) {
        setUser({ ...user });
      }
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

  const copyToClipboard = async (text) => {
    if (window.navigator.clipboard) {
      try {
        await window.navigator.clipboard.writeText(text);
        setMessage([
          'Result text copied to your clipboard.',
          'Share now with your friends :-)',
        ]);

        return;
      } catch (error) {}
    }

    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = 0;
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);
    textarea.textContent = text;
    textarea.focus();
    textarea.select();
    const result = document.execCommand('copy');
    textarea.remove();
    if (!result) {
      setMessage(['Failed to copy your result text.']);
    } else {
      setMessage([
        'Result text copied to your clipboard.',
        'Share now with your friends :-)',
      ]);
    }
  };

  const shareStats = async () => {
    const text = `@TheGoldRoad\nGoldRoad #${gameData.gameNo}\n${
      emojis[user.data.lastGamePlayed.tries - 1] || '👏'
    } ${user.data.lastGamePlayed.tries} ${
      user.data.lastGamePlayed.tries === 1 ? 'try' : 'tries'
    }\n#GoldRoad #GoldRoad${
      gameData.gameNo
    }\n\nPlay now: https://goldroad.web.app`;

    if (window.navigator.share) {
      try {
        await window.navigator.share({
          text,
        });
      } catch (error) {}

      return;
    }

    await copyToClipboard(text);
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
    <div className='stats-container gap-2'>
      {userDataLoading || gameDataLoading
        ? 'Loading...'
        : user && (
            <>
              {gameData && (
                <div className='stats-ticker'>
                  <NewGameTicker nextGameAt={gameData.nextGameAt} bordered />
                </div>
              )}
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
                    {/* <a
                      style={{ color: 'gold' }}
                      href='https://twitter.com/intent/tweet?text=Hello%20world'
                      target='_blank'
                    >
                      Tweet now
                    </a> */}
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
                    {user.data.isCurrLongestStreak
                      ? '☝️'
                      : `${user.data.longestStreak}${
                          user.data.longestStreak === 1 ? ' day' : ' days'
                        }`}
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

              <div className='stats-footer'>
                <div style={{ marginBottom: '1rem' }}>
                  Follow GoldRoad on Twitter{' '}
                  <a
                    href='https://twitter.com/thegoldroad'
                    target='_blank'
                    rel='noreferrer'
                  >
                    @TheGoldRoad
                  </a>
                </div>
                <div>
                  Made with ❤️ & coffee, by{' '}
                  <a
                    href='https://twitter.com/ra_jeeves'
                    target='_blank'
                    rel='noreferrer'
                  >
                    @ra_jeeves
                  </a>
                </div>
                <div>
                  For feedback, or anything else{' '}
                  <a href='mailto:i.rarsh@gmail.com?subject=[GoldRoad]'>
                    Contact me
                  </a>
                </div>
              </div>
            </>
          )}
    </div>
  );
};
