import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

import { useRealmApp } from './RealmApp';
import { Board } from './Board';
import coin from '../assets/media/coin.mp3';
import deny from '../assets/media/deny.mp3';
import noMoves from '../assets/media/no-moves.mp3';
import win from '../assets/media/win.mp3';
import './Game.css';

const gamePlayStatuses = [
  'You can only move up down, or left right',
  `Red dashed lines are walls you can't cross`,
  'There might be multiple paths to the goal',
  'Tap the button at the bottom to replay',
  'Come back tomorrow for a new puzzle',
];

const DEFAULT_STATE = {
  moves: 0,
  score: 0,
  max: 0,
  status: 'Begin by tapping the green coin',
  statusIndex: -1,
  lastMove: null,
  wrongMove: false,
  ended: false,
};

const gameSounds = {
  coin,
  deny,
  noMoves,
  win,
};

const player = new Audio(gameSounds.coin);

export const Game = ({ sounds, onGameNo }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeNodes, setActiveNodes] = useState([]);
  const [gameState, setGameState] = useState(DEFAULT_STATE);

  const realmApp = useRealmApp();
  const location = useLocation();
  const navigate = useNavigate();

  const isCurrentGame = location.pathname === '/';

  useEffect(() => {
    for (const gameSoundKey in gameSounds) {
      if (gameSoundKey !== 'coin') {
        new Audio(gameSounds[gameSoundKey]);
      }
    }
  }, []);

  useEffect(() => {
    const updateStreakOnNewGame = async (setChanges) => {
      console.log('updateStreakOnNewGame called');
      const result = await realmApp.client
        ?.db(process.env.REACT_APP_MONGO_DB_NAME)
        .collection('users')
        .findOneAndUpdate(
          { _id: user._id },
          {
            $set: {
              ...setChanges,
            },
          },
          {
            returnNewDocument: true,
          }
        );

      setUser(result);
      console.log('result of updateStreakOnNewGame: ', JSON.stringify(result));
    };

    if (user && game && isCurrentGame) {
      const lastGamePlayed = user.data.lastGamePlayed;
      if (
        lastGamePlayed &&
        ![0, 1].includes(game.gameNo - lastGamePlayed.gameNo) &&
        user.data.currStreak
      ) {
        const setChanges = {
          'data.currStreak': 0,
        };

        if (user.data.isCurrLongestStreak) {
          setChanges['data.isCurrLongestStreak'] = false;
        }

        updateStreakOnNewGame(setChanges);
      }
    }
  }, [user, game, realmApp.client, isCurrentGame]);

  useEffect(() => {
    const appDb = realmApp.client?.db(process.env.REACT_APP_MONGO_DB_NAME);
    const getGameData = async () => {
      setLoading(true);
      setError(null);
      if (onGameNo) {
        onGameNo('');
      }

      let url = process.env.REACT_APP_GAME_API_URL;
      if (!isCurrentGame) {
        const queryParts = location.pathname.split('/');
        if (queryParts.length > 2 && queryParts[2]) {
          url += `?num=${queryParts[2]}`;
        }
      }

      const resp = await fetch(url);
      if (!resp.ok) {
        setError('The requested game was not found...');
        setLoading(false);
        return;
      }

      const gameDoc = await resp.json();

      if (gameDoc) {
        const conns = [];
        const coins = gameDoc.coins;

        for (const coinsRow of coins) {
          conns.push([]);
          coinsRow.forEach(() => {
            conns[conns.length - 1].push(null);
          });
        }

        const startCoin =
          coins[parseInt(gameDoc.start[0])][parseInt(gameDoc.start[1])];
        startCoin.start = true;
        startCoin.active = true;
        setActiveNodes([startCoin.id]);
        const endCoin =
          coins[parseInt(gameDoc.end[0])][parseInt(gameDoc.end[1])];
        endCoin.end = true;

        setConnections(conns);
        setTiles(coins);
        setGame(gameDoc);
        setGameState({ ...DEFAULT_STATE, max: gameDoc.maxScore });
        if (onGameNo) {
          onGameNo(gameDoc.gameNo);
        }
      }

      setLoading(false);
    };

    const getUserData = async () => {
      if (realmApp.user && realmApp.user.id) {
        const user = await appDb
          ?.collection('users')
          ?.findOne({ _id: realmApp.user.id });
        setUser({ ...user });
      }
    };

    if (realmApp.client) {
      getGameData();
      getUserData();
    }
  }, [
    realmApp.client,
    realmApp.user,
    onGameNo,
    isCurrentGame,
    location.pathname,
  ]);

  const playSound = (src) => {
    if (sounds === 'on') {
      player.pause();
      player.src = src;
      player.play();
    }
  };

  const getUserStatsChanges = (solved, score, moves) => {
    const incChanges = {};
    const setChanges = {};

    const lastGamePlayed = user.data.lastGamePlayed;
    const isNewGame = !lastGamePlayed || lastGamePlayed.gameNo !== game.gameNo;

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

    if (solved && score === game.maxScore) {
      if (!isNewGame) {
        setChanges['data.lastGamePlayed.solved'] = true;
      } else {
        setChanges['data.lastGamePlayed'].solved = true;
      }

      incChanges['data.solves'] = 1;
      incChanges['data.currStreak'] = 1;

      if (user.data.isCurrLongestStreak) {
        incChanges['data.longestStreak'] = 1;
      } else if (user.data.currStreak === user.data.longestStreak) {
        incChanges['data.longestStreak'] = 1;
        setChanges['data.isCurrLongestStreak'] = true;
      } else if (user.data.currStreak === user.data.longestStreak - 1) {
        setChanges['data.isCurrLongestStreak'] = true;
      }
    }

    return { setChanges, incChanges };
  };

  const updateUserEntry = async (solved, score, moves) => {
    if (user && isCurrentGame) {
      const changes = getUserStatsChanges(solved, score, moves);
      if (changes) {
        const { incChanges, setChanges } = changes;
        const result = await realmApp.client
          ?.db(process.env.REACT_APP_MONGO_DB_NAME)
          .collection('users')
          .findOneAndUpdate(
            { _id: user._id },
            {
              $set: {
                ...setChanges,
              },
              $inc: {
                ...incChanges,
              },
            },
            {
              returnNewDocument: true,
            }
          );

        setUser(result);
        console.log('result of user data update: ', JSON.stringify(result));

        if (solved && score === game.maxScore) {
          navigate('/stats');
        }
      }
    }
  };

  const onBoardClick = (type, value) => {
    if (type === 'tile') {
      onTileClick(value);
    } else if (type === 'replay') {
      for (const rowTiles of tiles) {
        for (const tile of rowTiles) {
          const row = parseInt(tile.id[0]);
          const col = parseInt(tile.id[1]);
          if (
            row === parseInt(game.start[0]) &&
            col === parseInt(game.start[1])
          ) {
            tile.active = true;
            setActiveNodes([tile.id]);
          } else {
            tile.active = false;
          }

          tile.done = false;
        }
      }

      for (const rowConnections of connections) {
        for (let col = 0; col < rowConnections.length; col++) {
          rowConnections[col] = null;
        }
      }

      if (!gameState.ended) {
        updateUserEntry(false);
      }

      setGameState({ ...DEFAULT_STATE, max: game.maxScore });
    }
  };

  const onTileClick = (id) => {
    if (activeNodes.includes(id)) {
      const row = parseInt(id[0]);
      const col = parseInt(id[1]);

      const currNode = tiles[row][col];
      currNode.active = false;
      currNode.done = true;

      let statusIndex = gameState.statusIndex + 1;
      if (statusIndex > 4) {
        statusIndex = 0;
      }

      const changes = {
        score: gameState.score + currNode.value,
        moves: gameState.moves + 1,
        lastMove: [row, col],
        status: gamePlayStatuses[statusIndex],
        statusIndex,
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

      playSound(gameSounds.coin);

      for (const nodeId of activeNodes) {
        if (nodeId !== currNode.id) {
          const node = tiles[parseInt(nodeId[0])][parseInt(nodeId[1])];
          node.active = false;
        }
      }

      setActiveNodes([]);

      if (!currNode.end) {
        const freshActiveNodes = [];
        const prevNode = col > 0 ? tiles[row][col - 1] : null;
        const nextNode = col < tiles[0].length - 1 ? tiles[row][col + 1] : null;
        const topNode = row > 0 ? tiles[row - 1][col] : null;
        const bottomNode = row < tiles.length - 1 ? tiles[row + 1][col] : null;

        if (
          prevNode &&
          !prevNode.done &&
          prevNode.wall !== 2 &&
          currNode.wall !== 4
        ) {
          prevNode.active = true;
          freshActiveNodes.push(prevNode.id);
        }

        if (
          nextNode &&
          !nextNode.done &&
          nextNode.wall !== 4 &&
          currNode.wall !== 2
        ) {
          nextNode.active = true;
          freshActiveNodes.push(nextNode.id);
        }

        if (
          topNode &&
          !topNode.done &&
          topNode.wall !== 3 &&
          currNode.wall !== 1
        ) {
          topNode.active = true;
          freshActiveNodes.push(topNode.id);
        }

        if (
          bottomNode &&
          !bottomNode.done &&
          bottomNode.wall !== 1 &&
          currNode.wall !== 3
        ) {
          bottomNode.active = true;
          freshActiveNodes.push(bottomNode.id);
        }

        if (freshActiveNodes.length) {
          setActiveNodes(freshActiveNodes);
          // Need to show different score if it becomes more than the max score
          if (changes.score >= game.maxScore || gameState.wrongMove) {
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
          playSound(gameSounds.noMoves);
          updateUserEntry(false);
        }
      } else {
        if (changes.score === game.maxScore) {
          changes.status = "🏆 You've got the gold :-)";
        } else if (game.maxScore - changes.score <= 3) {
          changes.status = `👏 You're really close...`;
        } else {
          changes.status = '👻 Try getting some more...';
        }

        changes.ended = true;
        playSound(gameSounds.win);
        updateUserEntry(true, changes.score, changes.moves);
      }

      setGameState({
        ...gameState,
        ...changes,
      });
    } else {
      playSound(gameSounds.deny);
    }
  };

  return (
    <div className='board-container'>
      {loading ? (
        isCurrentGame ? (
          `Loading today's game...`
        ) : (
          'Loading the requested game...'
        )
      ) : error ? (
        <>
          <div className='error'>{error}</div>
          <br />
          <Link className='link' to='/' replace={true}>
            Play today's game
          </Link>
        </>
      ) : (
        <Board
          tiles={tiles}
          connections={connections}
          onClick={onBoardClick}
          state={gameState}
          lastGame={user?.data.lastGamePlayed}
          currGame={game}
        />
      )}
    </div>
  );
};
