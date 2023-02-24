import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaShare, FaPlayCircle, FaSignInAlt, FaBell } from 'react-icons/fa';
import { HiOutlineArrowNarrowRight } from 'react-icons/hi';

import { useFirebase } from '../providers/Firebase';
import { useAppData } from '../providers/AppData';
import { NewGameTicker } from './NewGameTicker';
import './Stats.css';

const UPPER_BOUND = 25;
const emojis = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
  '4+': '😅',
  '10+': '😥',
  '20+': '😓',
};

const plurals = {
  try: 'tries',
  road: 'roads',
  day: 'days',
};

export const Stats = () => {
  const [gameData, setGameData] = useState(null);
  const [message, setMessage] = useState(false);
  const [solveStats, setSolveStats] = useState([]);
  const [overallStats, setOverallStats] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);

  const location = useLocation();
  const { getGame } = useAppData();
  const {
    currentUser: userData,
    currentUserAuthInfo,
    showMessaging,
    RequestNotificationAccess,
  } = useFirebase();

  const solvedTodaysGame =
    gameData &&
    userData &&
    userData.data.lastGamePlayed &&
    gameData.gameNo === userData.data.lastGamePlayed.gameNo &&
    userData.data.lastGamePlayed.solved;

  const getFixedFractional = (
    numerator,
    denominator,
    fractionalDigits,
    isPercent
  ) => {
    if (denominator) {
      return parseFloat(
        ((numerator * (isPercent ? 100 : 1)) / denominator).toFixed(
          fractionalDigits
        )
      );
    }

    return 0;
  };

  useEffect(() => {
    if (userData?.data) {
      const statData = userData.data;
      const personalStats = statData.solveStats || {};
      let totalTries = 0;
      let totalSolves =
        (personalStats[1] || 0) +
        (personalStats[2] || 0) +
        (personalStats[3] || 0);

      const stats = [
        [
          {
            icon: emojis[1],
            count: personalStats[1] || 0,
            tries: '1 try',
            increment: location.state?.tries === 1,
          },
          {
            icon: emojis[2],
            count: personalStats[2] || 0,
            tries: '2 tries',
            increment: location.state?.tries === 2,
          },
          {
            icon: emojis[3],
            count: personalStats[3] || 0,
            tries: '3 tries',
            increment: location.state?.tries === 3,
          },
        ],
        [],
      ];

      let fourPlus = 0;
      let tenPlus = 0;
      let twentyPlus = 0;

      Object.keys(personalStats).forEach((tries) => {
        totalTries += parseInt(tries) * personalStats[tries];
        if (tries >= 4 && tries < 10) {
          fourPlus += personalStats[tries];
        } else if (tries >= 10 && tries < 20) {
          tenPlus += personalStats[tries];
        } else if (tries >= 20) {
          twentyPlus += personalStats[tries];
        }
      });

      stats[1].push({
        icon: emojis['4+'],
        count: fourPlus,
        tries: '4+ tries',
        increment: location.state?.tries >= 4 && location.state?.tries < 10,
      });
      stats[1].push({
        icon: emojis['10+'],
        count: tenPlus,
        tries: '10+ tries',
        increment: location.state?.tries >= 10 && location.state?.tries < 20,
      });
      stats[1].push({
        icon: emojis['20+'],
        count: twentyPlus,
        tries: '20+ tries',
        increment: location.state?.tries >= 20,
      });

      totalSolves += fourPlus + tenPlus + twentyPlus;

      setSolveStats(stats);

      const personalOverallStats = [
        {
          key: 'Current Streak',
          value: getPlural(statData.currStreak, 'day'),
        },
        {
          key: 'Longest Streak',
          value: statData.isCurrLongestStreak
            ? '☝️'
            : getPlural(statData.longestStreak, 'day'),
        },
        {
          key: 'Total Treads',
          value: getPlural(statData.played, 'road'),
        },
        {
          key: 'Total Finishes',
          value: getPlural(statData.solves, 'road'),
        },
        {
          key: 'Completion %',
          value: `${getFixedFractional(
            statData.solves,
            statData.played,
            0,
            true
          )}%`,
        },
        {
          key: 'Average # of Tries',
          value: getPlural(
            getFixedFractional(totalTries, totalSolves, 1),
            'try'
          ),
        },
      ];

      setOverallStats(personalOverallStats);
    }
  }, [userData, location.state]);

  const getEmoji = (tries) => {
    let emoji = emojis['20+'];
    if (tries < 4) {
      emoji = emojis[tries];
    } else if (tries >= 4 && tries < 10) {
      emoji = emojis['4+'];
    } else if (tries >= 10 && tries < 20) {
      emoji = emojis['10+'];
    }

    return emoji;
  };

  const getPlural = (count, word) => {
    let finalWord = word;
    if (count !== 1) {
      finalWord = plurals[word] || word;
    }

    return `${count} ${finalWord}`;
  };

  useEffect(() => {
    const getGameData = async () => {
      const gameDoc = await getGame();

      if (gameDoc) {
        setGameData(gameDoc);
      }
    };

    getGameData();
  }, [getGame]);

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
    const text = `@TheGoldRoad\nGoldRoad #${gameData.gameNo}\n${getEmoji(
      userData.data.lastGamePlayed.tries
    )} ${getPlural(
      userData.data.lastGamePlayed.tries,
      'try'
    )}\n#GoldRoad #GoldRoad${
      gameData.gameNo
    }\n\nPlay now: https://playgoldroad.com`;

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

  useEffect(() => {
    if (userData && gameData) {
      const stats = gameData.prevGameStats?.stats;

      if (stats?.tries) {
        let remainingPlayers = 0;
        const playerSolveInfo = userData.data?.games
          ? userData.data.games[gameData.prevGameStats.gameNo]
          : null;

        let topPlayers = 0;
        let allTries = 0;

        const remainingEntries = Object.keys(stats.tries).filter(
          (val) => parseInt(val) >= UPPER_BOUND
        );

        for (const key of remainingEntries) {
          remainingPlayers += stats.tries[key];
          allTries += parseInt(key) * stats.tries[key];
          if (playerSolveInfo?.solved) {
            if (playerSolveInfo.tries >= parseInt(key)) {
              topPlayers += stats.tries[key];
            }
          }
        }

        let maxPlayers = Math.max(
          ...Object.values(stats.tries),
          remainingPlayers
        );

        const gStats = { distributions: [] };

        for (let i = 1; i < UPPER_BOUND; i++) {
          const entry = {
            key: i,
            value: 1,
          };

          if (stats.tries[i]) {
            entry.value = getFixedFractional(
              stats.tries[i],
              maxPlayers,
              1,
              true
            );
            allTries += i * stats.tries[i];
            if (playerSolveInfo?.solved) {
              if (playerSolveInfo.tries >= i) {
                topPlayers += stats.tries[i];
                if (playerSolveInfo.tries === i) {
                  entry.highlight = true;
                }
              }
            }
          }

          gStats.distributions.push(entry);
        }

        const lastEntry = {
          key: `${UPPER_BOUND}+`,
          value: 1,
        };

        if (remainingPlayers) {
          lastEntry.value = getFixedFractional(
            remainingPlayers,
            maxPlayers,
            1,
            true
          );

          if (
            playerSolveInfo &&
            playerSolveInfo.solved &&
            playerSolveInfo.tries >= UPPER_BOUND
          ) {
            lastEntry.highlight = true;
          }
        }
        gStats.distributions.push(lastEntry);

        if (playerSolveInfo?.solved) {
          gStats.topPercentile = getFixedFractional(
            topPlayers,
            stats.played,
            0,
            true
          );
          gStats.tries = playerSolveInfo.tries;
        }

        gStats.solvePercent = getFixedFractional(
          stats.solved,
          stats.played,
          0,
          true
        );

        gStats.averageTries = getFixedFractional(allTries, stats.solved, 1);

        setGlobalStats(gStats);
      }
    }
  }, [userData, gameData]);

  const getSignedInInfo = () => {
    if (currentUserAuthInfo.isAnonymous) {
      return (
        <div className='stats-card gap-1_25'>
          <div className='text--dark text--center text--bold'>
            Save your playing history
          </div>
          <Link className='link' to='/sign-in'>
            <button type='button' className='btn'>
              <FaSignInAlt /> Sign in now
            </button>
          </Link>
        </div>
      );
    }

    const providerData = currentUserAuthInfo.providerData[0];
    const providerId = providerData.providerId.split('.')[0];
    const providerName = providerId[0].toUpperCase() + providerId.slice(1);

    return (
      <div className='stats-card'>
        <div className='text--dark text--center'>
          Currently signed in using {providerName}:
        </div>
        <div>
          {providerData.displayName && (
            <div className='text--bold text--center'>
              {providerData.displayName}
            </div>
          )}
          {providerData.email && (
            <div
              className={`text--center${
                providerData.displayName ? ' text--dark' : ' text--bold'
              }`}
            >
              {providerData.email}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='stats-container gap-1_25'>
      {!userData || !gameData
        ? 'Loading...'
        : userData && (
            <>
              {gameData && (
                <div className='ticker-card text--medium'>
                  <NewGameTicker nextGameAt={gameData.nextGameAt} />
                </div>
              )}
              {currentUserAuthInfo && getSignedInInfo()}
              <div className='solves-stats-container'>
                {solveStats.map((statsRow, row) => {
                  return (
                    <div key={`solve-row${row}`} className='solves-stats-row'>
                      {statsRow.map((stat) => {
                        return (
                          <div
                            key={`solve-${row}${stat.tries}`}
                            className='solves-card'
                          >
                            <div className='solve-stat'>
                              <span className='emoji-icon-big'>
                                {stat.icon}
                              </span>
                              <span
                                className={`multiply${
                                  row ? ' multiply-margin' : ''
                                }`}
                              >
                                x
                              </span>
                              <span className='solve-count'>{stat.count}</span>
                            </div>
                            <div className='solve-tries'>{stat.tries}</div>
                            {stat.increment && (
                              <span className='solve-increment'>+1</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className='stats-card gap-1_25'>
                <div className='stats-card-title'>Today's Road</div>
                {solvedTodaysGame ? (
                  <>
                    <div className='stats-congrats'>
                      Yay! You got to the finish line{' '}
                      <span className='emoji-icon-medium'>🎉</span>
                    </div>
                    <div className='stats-text'>
                      <span>@TheGoldRoad</span>

                      <div className='stats-text-content'>
                        GoldRoad #{gameData.gameNo}
                        <br />
                        <span className='emoji-icon-medium'>
                          {getEmoji(userData.data.lastGamePlayed.tries)}
                        </span>{' '}
                        {getPlural(userData.data.lastGamePlayed.tries, 'try')}
                        <br />
                        #GoldRoad #GoldRoad{gameData.gameNo}
                      </div>

                      <span>https://playgoldroad.com</span>
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
                    <button type='button' className='btn' onClick={shareStats}>
                      <FaShare /> Share now
                    </button>
                  </>
                ) : (
                  <>
                    <div>Umm...you haven't solved it yet!</div>
                    <Link className='link' to='/' replace={true}>
                      <button type='button' className='btn'>
                        <FaPlayCircle /> Play now
                      </button>
                    </Link>
                  </>
                )}
              </div>
              <div className='stats-card'>
                <div className='stats-card-title'>
                  Yesterday's Road
                  {gameData && `: #${gameData.prevGameStats.gameNo}`}
                </div>
                <div className='stats-congrats'>Global Stats</div>
                {globalStats && (
                  <>
                    <div className='graph-container'>
                      <div className='graph-plot'>
                        {globalStats.distributions.map((entry, index) => {
                          return (
                            <div
                              key={`try_${index}`}
                              className={`graph-entry${
                                entry.highlight ? ' highlight' : ''
                              }`}
                              style={{
                                height: `${entry.value}%`,
                              }}
                            >
                              {([0, UPPER_BOUND - 1].includes(index) ||
                                entry.highlight) && (
                                <span className='axis-marker'>{entry.key}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className='graph-label'>
                        <span>tries</span> <HiOutlineArrowNarrowRight />
                      </div>
                    </div>
                    <div>
                      <div className='global-stats-text'>
                        <strong>{globalStats.solvePercent}%</strong> of the
                        people who walked down{' '}
                        <strong>
                          GoldRoad #{gameData.prevGameStats.gameNo}
                        </strong>{' '}
                        finished it. On an average it took them{' '}
                        <strong>
                          {getPlural(globalStats.averageTries, 'try')}
                        </strong>
                        .
                      </div>
                      {globalStats.topPercentile ? (
                        <div className='global-stats-text'>
                          You got to the finish line in{' '}
                          <strong>{getPlural(globalStats.tries, 'try')}</strong>
                          , which was in the top{' '}
                          <strong>{globalStats.topPercentile}%</strong> of the
                          people who walked down the road.
                        </div>
                      ) : (
                        <div className='global-stats-text'>
                          Walk down today's road, and come back here tomorrow to
                          see how you fared against others.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {showMessaging && (
                <div className='stats-card gap-1_25'>
                  <div className='text--dark text--center text--bold'>
                    Get new roads notifications
                  </div>
                  <button
                    type='button'
                    className='btn'
                    onClick={RequestNotificationAccess}
                  >
                    <FaBell /> Allow access
                  </button>
                </div>
              )}
              <div className='stats-card'>
                <div className='stats-card-title'>Your Stats</div>
                {overallStats.map((statItem, index) => {
                  return (
                    <div
                      key={`personal-stat-${index}`}
                      className='stats-card-item'
                    >
                      <div className='stats-item-key'>{statItem.key}:</div>
                      <div className='stats-item-val'>{statItem.value}</div>
                    </div>
                  );
                })}
              </div>
              <div className='stats-card gap-1_25'>
                <div className='text--medium text--dark text--center text--bold'>
                  Keep walking & improving
                </div>

                <Link className='link' to='/games'>
                  <button type='button' className='btn'>
                    <FaPlayCircle /> Play past games
                  </button>
                </Link>
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
