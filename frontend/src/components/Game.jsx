import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';

import { useFirebase } from '../providers/Firebase';
import { useAppData } from '../providers/AppData';
import { Board } from './Board';
import { HowToPlayDialog } from './HowToPlayDialog';
import { GameFooter } from './GameFooter';

import { GAME_SOUNDS, useGameSounds } from '../hooks/useGameSounds';

import './Game.css';

const TILE_SIZE = 56;
const MIN_TILE_SIZE = 48;
const TILE_GAP = 8;
const OTHER_ELEMENTS_HEIGHT = 52 + 62 + 28 + 2 * 24 + 2 * 16;

const gamePlayStatuses = [
  'You can only move up/down, or left/right',
  `Red dashed lines are walls you can't cross`,
  'There might be multiple paths to the goal',
  'Tap the button at the bottom to replay',
  'Come back tomorrow for a new puzzle',
  ' ', // Empty status
];

const DEFAULT_STATE = {
  moves: 0,
  score: 0,
  status: '',
  lastMove: null,
  wrongMove: false,
  ended: false,
  tiles: [],
  tileSize: undefined,
  connections: [],
  activeNodes: [],
  error: null,
  maxScore: 0,
};

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

export const Game = ({ sounds }) => {
  const [loading, setLoading] = useState(false);
  const [game, setGame] = useState(null);
  const [gameState, setGameState] = useState(DEFAULT_STATE);
  const [userHistory, setUserHistory] = useState(null);
  const [useAlternateLayout, setUseAlternateLayout] = useState(false);

  const getHowToPlayShown = () => {
    return sessionStorage.getItem('howToPlayShown');
  };

  const [howToPlayShown, setHowToPlayShown] = useState(getHowToPlayShown());

  const navigate = useNavigate();
  const { playSound } = useGameSounds();

  //TODO: Check if we can remove the states for game & useHistory
  const {
    getGame,
    updateUserData,
    getUserHistoryForGame,
    updateUserGameHistory,
  } = useAppData();
  const { currentUser: userData, isNewUser } = useFirebase();
  const { gameId } = useParams();

  const markHowToPlayShown = () => {
    sessionStorage.setItem('howToPlayShown', 'yes');
    setHowToPlayShown(true);
  };

  useEffect(() => {
    const lastGame = userData?.data?.lastGamePlayed;
    if (
      userData &&
      lastGame &&
      userData.data.currStreak &&
      game &&
      game.current &&
      (![0, 1].includes(game.gameNo - lastGame.gameNo) ||
        (game.gameNo - lastGame.gameNo === 1 && !lastGame.solved))
    ) {
      const setChanges = {
        'data.currStreak': 0,
      };

      if (userData.data.isCurrLongestStreak) {
        setChanges['data.isCurrLongestStreak'] = false;
      }

      updateUserData({ $set: setChanges });
    }
  }, [userData, game, updateUserData]);

  const getTileSize = (numTiles) => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const totalGap = numTiles * TILE_GAP; // Don't care about the gap at the edges
    const boardSize = numTiles * TILE_SIZE + totalGap;
    let tSize;

    if (windowWidth < boardSize) {
      tSize = (windowWidth - totalGap) / numTiles;
    } else if (windowHeight < boardSize + OTHER_ELEMENTS_HEIGHT) {
      const alternateBoardSize = numTiles * MIN_TILE_SIZE + totalGap;

      tSize = MIN_TILE_SIZE;
      if (windowHeight > alternateBoardSize + OTHER_ELEMENTS_HEIGHT) {
        tSize = (windowHeight - totalGap - OTHER_ELEMENTS_HEIGHT) / numTiles;
      } else {
        setUseAlternateLayout(true);
      }
    }

    return tSize;
  };

  const onKeyboardEvent = useCallback(
    ({ curr, next }) => {
      const tiles = gameState.tiles;
      const currNode = tiles[curr.row][curr.col];
      currNode.tabIndex = -1;
      currNode.focus = false;
      const nextNode = tiles[next.row][next.col];
      nextNode.tabIndex = 0;
      nextNode.focus = true;

      setGameState({ ...gameState });
    },
    [gameState]
  );

  useEffect(() => {
    const getGameData = async () => {
      setLoading(true);
      setGameState({ ...DEFAULT_STATE });
      setGame(null);

      const gameDoc = await getGame(gameId);

      if (gameDoc) {
        if (gameId && gameDoc.current) {
          navigate('/', { replace: true });
          return;
        }

        const conns = [];
        const coins = gameDoc.coins;
        let totalValue = 0;

        for (const coinsRow of coins) {
          conns.push([]);
          for (const coin of coinsRow) {
            coin.tabIndex = -1;
            coin.focus = false;
            conns[conns.length - 1].push(null);
            totalValue += coin.value;
          }
        }

        const startCoin =
          coins[parseInt(gameDoc.start[0])][parseInt(gameDoc.start[1])];
        startCoin.start = true;
        startCoin.tabIndex = 0;
        startCoin.active = true;

        const endCoin =
          coins[parseInt(gameDoc.end[0])][parseInt(gameDoc.end[1])];
        endCoin.end = true;

        const tileSize = getTileSize(coins.length);

        setGame(gameDoc);
        setGameState({
          ...DEFAULT_STATE,
          tiles: coins,
          tileSize,
          status: `Total coins on the board: ${totalValue}`,
          totalValue,
          connections: conns,
          activeNodes: [startCoin.id],
          maxScore: gameDoc.maxScore,
        });
      } else {
        setGameState({
          ...DEFAULT_STATE,
          error: 'The requested game was not found...',
        });
      }

      setLoading(false);
    };

    getGameData();
  }, [gameId, getGame, navigate]);

  useEffect(() => {
    const getUserHistory = async () => {
      const history = await getUserHistoryForGame(game.gameNo);
      if (history) {
        setUserHistory({ ...history });
      }
    };

    if (game) {
      // console.log('calling getUserHistory from the game page');
      getUserHistory();
    }
  }, [game, getUserHistoryForGame]);

  const updateUserEntry = useCallback(
    async (solved, score, moves) => {
      const getUserStatsChanges = (solved, score, moves) => {
        const incChanges = {};
        const setChanges = {};

        const lastGamePlayed = userData.data.lastGamePlayed;
        const isNewGame =
          !lastGamePlayed || lastGamePlayed.gameNo !== game.gameNo;

        if (isNewGame) {
          const currGame = {
            _id: game._id,
            gameNo: game.gameNo,
            solved: false,
            score,
            moves,
            target: game.maxScore,
            tries: 1,
          };

          setChanges['data.lastGamePlayed'] = currGame;
          incChanges['data.played'] = 1;
          if (!lastGamePlayed) {
            setChanges['data.firstGame'] = game.gameNo;
          }
        } else {
          // If the current game is already solved, return
          if (lastGamePlayed.solved) {
            return;
          }

          incChanges['data.lastGamePlayed.tries'] = 1;
          if (solved && score > lastGamePlayed.score) {
            setChanges['data.lastGamePlayed.score'] = score;
            setChanges['data.lastGamePlayed.moves'] = moves;
          }
        }

        incChanges[`data.games.${game.gameNo}.tries`] = 1;
        if (solved && score === game.maxScore) {
          let finalTries = 1;
          if (!isNewGame) {
            setChanges['data.lastGamePlayed.solved'] = true;
            setChanges['data.lastGamePlayed.gameId'] = game._id; //send a new field so that it will be included in the updatedFields
            finalTries = lastGamePlayed.tries + 1;
          } else {
            setChanges['data.lastGamePlayed'].solved = true;
          }

          incChanges[`data.solveStats.${finalTries}`] = 1;
          setChanges[`data.games.${game.gameNo}.solved`] = true;

          incChanges['data.solves'] = 1;
          incChanges['data.currStreak'] = 1;

          if (userData.data.isCurrLongestStreak) {
            incChanges['data.longestStreak'] = 1;
          } else if (userData.data.currStreak === userData.data.longestStreak) {
            incChanges['data.longestStreak'] = 1;
            setChanges['data.isCurrLongestStreak'] = true;
          } else if (
            userData.data.currStreak ===
            userData.data.longestStreak - 1
          ) {
            setChanges['data.isCurrLongestStreak'] = true;
          }
        }

        return { $set: setChanges, $inc: incChanges };
      };

      const getUserGamesChanges = (solved, score, moves) => {
        let incChanges, setChanges, pushChanges;
        const date = new Date();
        const isNewGame = !userHistory;
        const isGameSolved = solved && score === game.maxScore;

        let userDataChanges;
        let userTries;

        if (isNewGame) {
          setChanges = {
            gameNo: game.gameNo,
            owner_id: userData._id,
            attempts: [
              {
                tries: 1,
                solved: isGameSolved,
                current: datesEqual(game.playedAt, date, true),
                playedAt: date,
              },
            ],
            createdAt: date,
            updatedAt: date,
          };

          if (isGameSolved) {
            setChanges.firstSolved = 0;
            userTries = 1;
          }

          if (gameId) {
            userDataChanges = {
              $inc: {
                'data.played': 1,
              },
            };

            if (isGameSolved) {
              userDataChanges.$inc['data.solves'] = 1;
              userDataChanges.$inc['data.solveStats.1'] = 1;
              userTries = 1;
            }
          }
        } else {
          const lastAttemptIndex = userHistory.attempts.length - 1;
          const lastAttemptAt = userHistory.attempts[lastAttemptIndex].playedAt;

          if (datesEqual(date, lastAttemptAt)) {
            if (userHistory.attempts[lastAttemptIndex].solved) {
              // Going to track only once for a given day
              return;
            }

            incChanges = {
              [`attempts.${lastAttemptIndex}.tries`]: 1,
            };

            setChanges = {
              updatedAt: date,
            };

            if (isGameSolved) {
              setChanges[`attempts.${lastAttemptIndex}.solved`] = true;
              if (userHistory.firstSolved === undefined) {
                if (userHistory.attempts[lastAttemptIndex].current) {
                  setChanges[`attempts.${lastAttemptIndex}.current`] =
                    datesEqual(game.playedAt, date, true);
                }

                setChanges.firstSolved = lastAttemptIndex;
                userTries = userHistory.attempts[lastAttemptIndex].tries + 1;
                if (gameId) {
                  userDataChanges = {
                    $inc: {
                      'data.solves': 1,
                      [`data.solveStats.${userTries}`]: 1,
                    },
                  };
                }
              }
            }
          } else {
            pushChanges = {
              attempts: {
                tries: 1,
                solved: isGameSolved,
                playedAt: date,
              },
            };

            setChanges = {
              updatedAt: date,
            };

            if (isGameSolved && userHistory.firstSolved === undefined) {
              setChanges = {
                firstSolved: userHistory.attempts.length,
              };

              userTries = 1;
              if (gameId) {
                userDataChanges = {
                  $inc: {
                    'data.solves': 1,
                    'data.solveStats.1': 1,
                  },
                };
              }
            }
          }
        }

        const changes = {
          $set: setChanges,
        };

        if (incChanges) {
          changes.$inc = incChanges;
        }

        if (pushChanges) {
          changes.$push = pushChanges;
        }

        // await updateUserGameHistory(game.gameNo, changes);

        if (!gameId) {
          userDataChanges = getUserStatsChanges(solved, score, moves);
        }

        return {
          userGameChanges: changes,
          userChanges: userDataChanges,
          userTries,
        };
      };

      if (userData) {
        const finalChanges = getUserGamesChanges(solved, score, moves);
        if (finalChanges?.userGameChanges || finalChanges?.userChanges) {
          await updateUserGameHistory(game.gameNo, {
            userChanges: finalChanges.userChanges,
            userGameChanges: finalChanges.userGameChanges,
          });
        }

        if (solved && score === game.maxScore) {
          navigate('/stats', { state: { tries: finalChanges?.userTries } });
        }
      }
    },
    [userData, userHistory, game, gameId, navigate, updateUserGameHistory]
  );

  const replayGame = () => {
    const focussedNodeRow = gameState.tiles.find((row) => {
      const found = row.find((tile) => tile.focus);
      return !!found;
    });

    const activeNodes = [];
    for (const rowTiles of gameState.tiles) {
      for (const tile of rowTiles) {
        const row = parseInt(tile.id[0]);
        const col = parseInt(tile.id[1]);
        if (
          row === parseInt(game.start[0]) &&
          col === parseInt(game.start[1])
        ) {
          tile.active = true;
          if (focussedNodeRow) {
            tile.focus = true;
          }
          tile.tabIndex = 0;
          activeNodes.push(tile.id);
        } else {
          tile.active = false;
          tile.focus = false;
          tile.tabIndex = -1;
        }

        tile.done = false;
      }
    }

    for (const rowConnections of gameState.connections) {
      for (let col = 0; col < rowConnections.length; col++) {
        rowConnections[col] = null;
      }
    }

    if (!gameState.ended) {
      updateUserEntry(false);
    }

    const tileSize = getTileSize(gameState.tiles.length);
    setGameState({
      ...DEFAULT_STATE,
      status: `Total coins on the board: ${gameState.totalValue}`,
      tileSize,
      activeNodes,
      tiles: gameState.tiles,
      totalValue: gameState.totalValue,
      connections: gameState.connections,
      maxScore: gameState.maxScore,
    });
  };

  const onTileClick = useCallback(
    (id) => {
      const connections = gameState.connections;
      const tiles = gameState.tiles;

      if (gameState.activeNodes.includes(id)) {
        const row = parseInt(id[0]);
        const col = parseInt(id[1]);

        const currNode = tiles[row][col];
        currNode.active = false;
        currNode.done = true;
        currNode.tabIndex = 0;
        if (gameState.lastMove) {
          tiles[gameState.lastMove[0]][gameState.lastMove[1]].tabIndex = -1;
        }

        const changes = {
          score: gameState.score + currNode.value,
          moves: gameState.moves + 1,
          lastMove: [row, col],
          activeNodes: [],
        };

        if (gameState.lastMove) {
          const [lastRow, lastCol] = gameState.lastMove;
          let dir;
          if (lastRow === row) {
            dir = lastCol > col ? 'left' : 'right';
          } else {
            dir = lastRow > row ? 'top' : 'bottom';
          }

          connections[lastRow][lastCol] = dir;
        }

        playSound(sounds, GAME_SOUNDS.COIN);

        for (const nodeId of gameState.activeNodes) {
          if (nodeId !== currNode.id) {
            const node = tiles[parseInt(nodeId[0])][parseInt(nodeId[1])];
            node.active = false;
          }
        }

        if (!currNode.end) {
          const prevNode = col > 0 ? tiles[row][col - 1] : null;
          const nextNode =
            col < tiles[0].length - 1 ? tiles[row][col + 1] : null;
          const topNode = row > 0 ? tiles[row - 1][col] : null;
          const bottomNode =
            row < tiles.length - 1 ? tiles[row + 1][col] : null;

          if (
            prevNode &&
            !prevNode.done &&
            prevNode.wall !== 2 &&
            currNode.wall !== 4
          ) {
            prevNode.active = true;
            changes.activeNodes.push(prevNode.id);
          }

          if (
            nextNode &&
            !nextNode.done &&
            nextNode.wall !== 4 &&
            currNode.wall !== 2
          ) {
            nextNode.active = true;
            changes.activeNodes.push(nextNode.id);
          }

          if (
            topNode &&
            !topNode.done &&
            topNode.wall !== 3 &&
            currNode.wall !== 1
          ) {
            topNode.active = true;
            changes.activeNodes.push(topNode.id);
          }

          if (
            bottomNode &&
            !bottomNode.done &&
            bottomNode.wall !== 1 &&
            currNode.wall !== 3
          ) {
            bottomNode.active = true;
            changes.activeNodes.push(bottomNode.id);
          }

          if (changes.activeNodes.length) {
            // Need to show different score if it becomes more than the max score
            if (changes.score >= gameState.maxScore || gameState.wrongMove) {
              changes.score = 0;
              changes.status = `This road feels unfamiliar...`;
              if (!gameState.wrongMove) {
                changes.wrongMove = true;
              }
            }
          } else {
            changes.status = 'Uh Oh! No further moves...';
            changes.score = 0; // If no further moves possible, then reset the score to 0
            changes.ended = true;
            playSound(sounds, GAME_SOUNDS.NO_MOVES);
            updateUserEntry(false);
          }
        } else {
          let winSound = GAME_SOUNDS.WIN;
          if (changes.score === gameState.maxScore) {
            changes.status = "🏆 You've got the gold :-)";
          } else if (gameState.maxScore - changes.score <= 3) {
            changes.status = `👏 That was close. Try again!`;
            winSound = GAME_SOUNDS.OKAY;
          } else {
            changes.status = '👻 Get some more coins. Try again!';
            winSound = GAME_SOUNDS.OKAY;
          }

          changes.ended = true;
          playSound(sounds, winSound);
          updateUserEntry(true, changes.score, changes.moves);
        }

        setGameState({
          ...gameState,
          ...changes,
        });
      } else {
        playSound(sounds, GAME_SOUNDS.DENY);
      }
    },
    [gameState, sounds, playSound, updateUserEntry]
  );

  return (
    <div className='board-container'>
      {loading ? (
        gameId ? (
          'Loading the requested game...'
        ) : (
          `Loading today's game...`
        )
      ) : gameState.error ? (
        <>
          <div className='error'>{gameState.error}</div>
          <br />
          <Link className='link' to='/' replace={true}>
            Play today's game
          </Link>
        </>
      ) : gameState.tiles.length > 0 ? (
        useAlternateLayout ? (
          <div className='alternate-layout'>
            <Board
              tiles={gameState.tiles}
              tileSize={gameState.tileSize}
              connections={gameState.connections}
              onClick={onTileClick}
              keyboardEventListener={onKeyboardEvent}
            />
            <div className='alternate-layout-info'>
              <div className='game-item game-info'>
                <span className='score'>
                  Collect {game.maxScore - gameState.score} coins
                  {gameState.score > 0 ? ' more' : ' in your path'}
                </span>
                <span className='status'>{gameState.status}</span>
              </div>

              <GameFooter
                gameState={gameState}
                userData={userData}
                lastGame={gameId ? userHistory : userData?.data?.lastGamePlayed}
                game={game}
                onClick={replayGame}
              />
            </div>
          </div>
        ) : (
          <>
            <div className='game-item game-info'>
              <span className='score'>
                Collect {game.maxScore - gameState.score} coins
                {gameState.score > 0 ? ' more' : ' in your path'}
              </span>
              <span className='status'>{gameState.status}</span>
            </div>
            <Board
              tiles={gameState.tiles}
              tileSize={gameState.tileSize}
              connections={gameState.connections}
              onClick={onTileClick}
              keyboardEventListener={onKeyboardEvent}
            />

            <GameFooter
              gameState={gameState}
              userData={userData}
              lastGame={gameId ? userHistory : userData?.data?.lastGamePlayed}
              game={game}
              onClick={replayGame}
            />
          </>
        )
      ) : (
        'Welcome to GoldRoad, a daily puzzle game'
      )}

      <HowToPlayDialog
        show={
          (isNewUser() || (userData && !userData.data.lastGamePlayed)) &&
          !howToPlayShown
        }
        onClose={markHowToPlayShown}
      />
    </div>
  );
};
