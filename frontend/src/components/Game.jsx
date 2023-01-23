import { useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { FaRedo } from 'react-icons/fa';

import { useAppData } from './AppData';
import { Board } from './Board';
import { NewGameTicker } from './NewGameTicker';
import { GAME_SOUNDS, useGameSounds } from './useGameSounds';

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
  status: 'Get to the red coin. To begin tap the green one',
  statusIndex: -1,
  lastMove: null,
  wrongMove: false,
  ended: false,
  tiles: [],
  connections: [],
  activeNodes: [],
  error: null,
};

const getOrdinal = (n) => {
  return ['st', 'nd', 'rd'][((((n + 90) % 100) - 10) % 10) - 1] || 'th';
};

const GameFooter = ({ gameState, lastGame, game, onClick }) => {
  if (gameState.moves) {
    return (
      <div className='game-item'>
        <FaRedo className='redo' onClick={onClick} />
      </div>
    );
  }

  if (!lastGame || lastGame.gameNo !== game.gameNo) {
    return (
      <div className='game-item status'>Find your way to the red coin</div>
    );
  }

  if (lastGame.solved) {
    return (
      <div className='game-item status'>
        <NewGameTicker nextGameAt={game.nextGameAt} />
      </div>
    );
  } else {
    return (
      <div className='game-item status'>
        {lastGame.tries + 1}
        {getOrdinal(lastGame.tries + 1)} try
      </div>
    );
  }
};

export const Game = ({ sounds }) => {
  const [loading, setLoading] = useState(false);
  const [game, setGame] = useState(null);
  const [gameState, setGameState] = useState(DEFAULT_STATE);

  const navigate = useNavigate();
  const { playSound } = useGameSounds();

  const { getGame, userData, updateUserData } = useAppData();
  const { gameId } = useParams();

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

  useEffect(() => {
    const getGameData = async () => {
      setLoading(true);
      setGameState({ ...DEFAULT_STATE });
      setGame(null);

      const gameDoc = await getGame(gameId);

      if (gameDoc) {
        if (gameId && gameDoc.current) {
          navigate('/');
          return;
        }

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

        const endCoin =
          coins[parseInt(gameDoc.end[0])][parseInt(gameDoc.end[1])];
        endCoin.end = true;

        setGame(gameDoc);
        setGameState({
          ...DEFAULT_STATE,
          tiles: coins,
          connections: conns,
          activeNodes: [startCoin.id],
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

  const playGameSound = (sound) => {
    if (sounds === 'on') {
      playSound(sound);
    }
  };

  const getUserStatsChanges = (solved, score, moves) => {
    const incChanges = {};
    const setChanges = {};

    const lastGamePlayed = userData.data.lastGamePlayed;
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
      } else if (userData.data.currStreak === userData.data.longestStreak - 1) {
        setChanges['data.isCurrLongestStreak'] = true;
      }
    }

    return { setChanges, incChanges };
  };

  const updateUserEntry = async (solved, score, moves) => {
    if (userData && !gameId) {
      const changes = getUserStatsChanges(solved, score, moves);
      if (changes) {
        const { incChanges, setChanges } = changes;
        await updateUserData({ $set: setChanges, $inc: incChanges });

        if (solved && score === game.maxScore) {
          navigate('/stats');
        }
      }
    }
  };

  const replayGame = () => {
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
          activeNodes.push(tile.id);
        } else {
          tile.active = false;
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

    setGameState({
      ...DEFAULT_STATE,
      tiles: gameState.tiles,
      connections: gameState.connections,
      activeNodes,
    });
  };

  const onTileClick = (id) => {
    const connections = gameState.connections;
    const tiles = gameState.tiles;

    if (gameState.activeNodes.includes(id)) {
      const row = parseInt(id[0]);
      const col = parseInt(id[1]);

      const currNode = tiles[row][col];
      currNode.active = false;
      currNode.done = true;

      let statusIndex =
        gameState.statusIndex < gamePlayStatuses.length - 1
          ? gameState.statusIndex + 1
          : gameState.statusIndex;

      const changes = {
        score: gameState.score + currNode.value,
        moves: gameState.moves + 1,
        lastMove: [row, col],
        status: gamePlayStatuses[statusIndex],
        statusIndex,
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

      playGameSound(GAME_SOUNDS.COIN);

      for (const nodeId of gameState.activeNodes) {
        if (nodeId !== currNode.id) {
          const node = tiles[parseInt(nodeId[0])][parseInt(nodeId[1])];
          node.active = false;
        }
      }

      if (!currNode.end) {
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
          playGameSound(GAME_SOUNDS.NO_MOVES);
          updateUserEntry(false);
        }
      } else {
        let winSound = GAME_SOUNDS.WIN;
        if (changes.score === game.maxScore) {
          changes.status = "🏆 You've got the gold :-)";
        } else if (game.maxScore - changes.score <= 3) {
          changes.status = `👏 You're really close...`;
          winSound = GAME_SOUNDS.CLAPPING;
        } else {
          changes.status = '👻 Try getting some more...';
          winSound = GAME_SOUNDS.OKAY;
        }

        changes.ended = true;
        playGameSound(winSound);
        updateUserEntry(true, changes.score, changes.moves);
      }

      setGameState({
        ...gameState,
        ...changes,
      });
    } else {
      playGameSound(GAME_SOUNDS.DENY);
    }
  };

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
        <>
          <div className='game-item game-info'>
            <span className='score'>
              Collect {game.maxScore - gameState.score} coins{' '}
              {gameState.score > 0 && 'more'}
            </span>
            <span className='status'>{gameState.status}</span>
          </div>
          <Board
            tiles={gameState.tiles}
            connections={gameState.connections}
            onClick={onTileClick}
          />
          <GameFooter
            gameState={gameState}
            lastGame={userData?.data?.lastGamePlayed}
            game={game}
            onClick={replayGame}
          />
        </>
      ) : (
        'Welcome to GoldRoad, a daily puzzle game'
      )}
    </div>
  );
};
