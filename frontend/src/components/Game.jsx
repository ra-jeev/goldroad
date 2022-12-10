import { useEffect, useState } from 'react';

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
  status: 'Find your way to the red coin',
  statusIndex: -1,
  lastMove: null,
};

const gameSounds = {
  coin,
  deny,
  noMoves,
  win,
};

const player = new Audio();

export const Game = ({ sounds, onGameNo }) => {
  const [loading, setLoading] = useState(false);
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeNodes, setActiveNodes] = useState([]);
  const [gameState, setGameState] = useState(DEFAULT_STATE);

  const realmApp = useRealmApp();

  useEffect(() => {
    const appDb = realmApp.client?.db('goldroadDb');
    const getGameData = async () => {
      setLoading(true);
      const gameDoc = await appDb
        ?.collection('games')
        ?.findOne({ current: true });

      if (gameDoc) {
        const conns = [];
        const coins = gameDoc.coins;

        for (const coinsRow of coins) {
          conns.push([]);
          for (const _ of coinsRow) {
            conns[conns.length - 1].push(null);
          }
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

        setLoading(false);
      }
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
  }, [realmApp.client, realmApp.user, onGameNo]);

  const playSound = (src) => {
    if (sounds === 'on') {
      player.src = src;
      player.play();
    }
  };

  const updateUserEntry = async (solved, score, moves) => {
    if (user) {
      if (user.data.lastGamePlayed) {
        const lastGamePlayed = user.data.lastGamePlayed;
        if (lastGamePlayed.gameNo === game.gameNo) {
          const incChanges = {};
          const setChanges = {};

          if (!lastGamePlayed.solved) {
            incChanges['data.lastGamePlayed.tries'] = 1;
            if (solved && score === game.maxScore) {
              setChanges['data.lastGamePlayed.solved'] = true;
              incChanges['data.currStreak'] = 1;
              incChanges['data.solves'] = 1;
              if (user.data.isCurrLongestStreak) {
                incChanges['data.longestStreak'] = 1;
              } else if (user.data.currStreak === user.data.longestStreak) {
                incChanges['data.longestStreak'] = 1;
                setChanges['data.isCurrLongestStreak'] = true;
              }
            }

            if (score > lastGamePlayed.score) {
              setChanges['data.lastGamePlayed.score'] = score;
              setChanges['data.lastGamePlayed.moves'] = moves;
            }

            const result = await realmApp.client
              ?.db('goldroadDb')
              .collection('users')
              ?.updateOne(
                { _id: user._id },
                {
                  $set: {
                    ...setChanges,
                  },
                  $inc: {
                    ...incChanges,
                  },
                }
              );

            console.log('result of user data update: ', JSON.stringify(result));
          }
        } else {
          // played
          const incChanges = {};
          const setChanges = {};

          const newLastGamePlayed = {
            _id: game._id,
            gameNo: game.gameNo,
            solved: false,
            score,
            moves,
            target: game.maxScore,
            tries: 1,
          };

          if (solved && score === game.maxScore) {
            newLastGamePlayed.solved = true;
          }

          setChanges['data.lastGamePlayed'] = newLastGamePlayed;
          incChanges['data.played'] = 1;
          if (lastGamePlayed.gameNo === game.gameNo - 1) {
            if (solved && score === game.maxScore) {
              incChanges['data.currStreak'] = 1;
              incChanges['data.solves'] = 1;
              if (user.data.isCurrLongestStreak) {
                incChanges['data.longestStreak'] = 1;
              } else if (user.data.currStreak === user.data.longestStreak) {
                incChanges['data.longestStreak'] = 1;
                setChanges['data.isCurrLongestStreak'] = true;
              }
            }
          } else {
            // Need to update the streak even if the game was not played
            setChanges['data.currStreak'] =
              solved && score === game.maxScore ? 1 : 0;
            if (setChanges['data.currStreak'] < user.data.longestStreak) {
              setChanges['data.isCurrLongestStreak'] = false;
            } else {
              incChanges['data.longestStreak'] = 1;
              setChanges['data.isCurrLongestStreak'] = true;
            }
          }

          const result = await realmApp.client
            ?.db('goldroadDb')
            .collection('users')
            ?.updateOne(
              { _id: user._id },
              {
                $set: {
                  ...setChanges,
                },
                $inc: {
                  ...incChanges,
                },
              }
            );

          console.log('result of user data update: ', JSON.stringify(result));
        }
      } else {
        const setChanges = {};
        const incChanges = {};

        setChanges['data.lastGamePlayed'] = {
          _id: game._id,
          gameNo: game.gameNo,
          solved: false,
          score,
          moves,
          target: game.maxScore,
          tries: 1,
        };

        incChanges['data.played'] = 1;
        if (solved && score === game.maxScore) {
          setChanges['data.lastGamePlayed'].solved = true;
          incChanges['data.currStreak'] = 1;
          incChanges['data.longestStreak'] = 1;
          incChanges['data.solves'] = 1;
          setChanges['data.isCurrLongestStreak'] = true;
        }

        const result = await realmApp.client
          ?.db('goldroadDb')
          .collection('users')
          ?.updateOne(
            { _id: user._id },
            {
              $set: {
                ...setChanges,
              },
            }
          );

        console.log('result of user data update: ', JSON.stringify(result));
      }
    }
  };

  const onBoardClick = (type, value) => {
    if (type === 'tile') {
      onTileClick(value);
    } else if (type === 'replay') {
      setGameState({ ...DEFAULT_STATE, max: game.maxScore });

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
        } else {
          changes.status = 'Uh Oh! No further moves...';
          playSound(gameSounds.noMoves);
          updateUserEntry(false);
        }
      } else {
        if (changes.score === game.maxScore) {
          changes.status = "🏆 You've got the gold :-)";
        } else if (game.maxScore - changes.score <= 5) {
          changes.status = `👏 You're really close...`;
        } else {
          changes.status = '👻 Try getting some more...';
        }

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
        `Loading today's game...`
      ) : (
        <Board
          tiles={tiles}
          connections={connections}
          onClick={onBoardClick}
          state={gameState}
        />
      )}
    </div>
  );
};
