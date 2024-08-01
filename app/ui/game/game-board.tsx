'use client';

import { useCallback, useState } from 'react';
import SoundManager, { type SoundName } from '@/app/lib/sound-manager';
import { useGameSounds } from '@/app/hooks/useGameSounds';
import type {
  Coin,
  CoinState,
  ConnectionDir,
  Game,
  PlayStatus,
} from '@/app/lib/types';
import { CoinWall } from '@/app/lib/types';
import BoardCoin from '@/app/ui/game/board-coin';
import BoardStatus from '@/app/ui/game/board-status';
import styles from '@/app/ui/game/game-board.module.css';

const changeCoinState = (
  coin: Coin | null,
  newCoins: Coin[],
  state: CoinState
) => {
  if (coin && coin.state !== 'done') {
    newCoins[coin.index] = { ...coin, state };
    return true;
  }

  return false;
};

const handleNeighboringCoins = (
  currIndex: number,
  newCoins: Coin[],
  makeActive: boolean,
  gameCols: number
) => {
  const topCoin =
    currIndex - gameCols >= 0 ? newCoins[currIndex - gameCols] : null;
  const bottomCoin =
    currIndex + gameCols < newCoins.length
      ? newCoins[currIndex + gameCols]
      : null;
  const leftCoin =
    currIndex % gameCols && currIndex - 1 >= 0 ? newCoins[currIndex - 1] : null;
  const rightCoin =
    (currIndex + 1) % gameCols !== 0 && currIndex + 1 < newCoins.length
      ? newCoins[currIndex + 1]
      : null;

  let totalChanges = 0;

  if (makeActive) {
    const currCoin = newCoins[currIndex];
    if (
      currCoin.wall !== CoinWall.Top &&
      topCoin &&
      topCoin.wall !== CoinWall.Bottom
    ) {
      totalChanges += Number(changeCoinState(topCoin, newCoins, 'active'));
    }

    if (
      currCoin.wall !== CoinWall.Bottom &&
      bottomCoin &&
      bottomCoin.wall !== CoinWall.Top
    ) {
      totalChanges += Number(changeCoinState(bottomCoin, newCoins, 'active'));
    }

    if (
      currCoin.wall !== CoinWall.Left &&
      leftCoin &&
      leftCoin.wall !== CoinWall.Right
    ) {
      totalChanges += Number(changeCoinState(leftCoin, newCoins, 'active'));
    }

    if (
      currCoin.wall !== CoinWall.Right &&
      rightCoin &&
      rightCoin.wall !== CoinWall.Left
    ) {
      totalChanges += Number(changeCoinState(rightCoin, newCoins, 'active'));
    }
  } else {
    totalChanges += Number(changeCoinState(topCoin, newCoins, 'none'));
    totalChanges += Number(changeCoinState(bottomCoin, newCoins, 'none'));
    totalChanges += Number(changeCoinState(leftCoin, newCoins, 'none'));
    totalChanges += Number(changeCoinState(rightCoin, newCoins, 'none'));
  }

  return totalChanges;
};

const getConnectionDirection = (
  prevIndex: number,
  currIndex: number,
  gameCols: number
): ConnectionDir => {
  const diff = currIndex - prevIndex;
  if (diff === 1) return 'right';
  if (diff === -1) return 'left';
  if (diff === gameCols) return 'down';
  if (diff === -gameCols) return 'up';

  return 'none';
};

type GameState = {
  lastClickedIndex: number;
  movesCount: number;
  currScore: number;
  wrongPath: boolean;
  status: PlayStatus;
  coins: Coin[];
};

const INITIAL_GAME_STATE: GameState = {
  lastClickedIndex: -1,
  movesCount: 0,
  currScore: 0,
  wrongPath: false,
  status: 'initial',
  coins: [],
};

export default function GameBoard({ game }: { game: Game }) {
  const [gameState, setGameState] = useState<GameState>(() => {
    const coins = game.coins.map((value, index) => ({
      index,
      value,
      isStart: game.start === index,
      isEnd: game.end === index,
      wall: game.walls[index] ?? CoinWall.None,
      state: (game.start === index ? 'active' : 'none') as CoinState,
      tabIndex: game.start === index ? 0 : -1,
      connection: 'none' as ConnectionDir,
      focus: false,
    }));

    return {
      ...INITIAL_GAME_STATE,
      coins,
    };
  });

  const { gameSounds } = useGameSounds();

  const playSound = useCallback(
    (soundName: SoundName) => {
      if (gameSounds === 'off') {
        return;
      }

      SoundManager.play(soundName);
    },
    [gameSounds]
  );

  const handleCoinClick = useCallback(
    (index: number, state: CoinState) => {
      if (state === 'active') {
        playSound('coin');

        setGameState((prevState) => {
          // Create a new coins array
          const newCoins = [...prevState.coins];

          // Replace the old coin with a new object
          const currCoin = newCoins[index];
          newCoins[index] = { ...currCoin, state: 'done', tabIndex: 0 };

          const changes: Partial<GameState> = {
            lastClickedIndex: index,
            currScore: prevState.currScore + currCoin.value,
            movesCount: prevState.movesCount + 1,
          };

          if (prevState.status === 'initial') {
            changes.status = 'playing';
          }

          // find other currently active coins, and make them inactive
          if (prevState.lastClickedIndex !== -1) {
            const lastClickedIndex = prevState.lastClickedIndex;
            const direction = getConnectionDirection(
              lastClickedIndex,
              index,
              game.cols
            );

            // Now we have a new last clicked coin, so set this one's tabIndex -1
            newCoins[lastClickedIndex] = {
              ...newCoins[lastClickedIndex],
              tabIndex: -1,
              connection: direction,
            };

            handleNeighboringCoins(
              lastClickedIndex,
              newCoins,
              false,
              game.cols
            );
          }

          if (!currCoin.isEnd) {
            // find the coins that should be active now
            const activeCoinsCount = handleNeighboringCoins(
              index,
              newCoins,
              true,
              game.cols
            );

            if (!activeCoinsCount) {
              changes.status = 'no-moves';
              changes.currScore = 0; // If no further moves possible, then reset the score to 0
              // changes.ended = true;
              playSound('noMoves');
            } else if (
              prevState.wrongPath ||
              changes.currScore! >= game.maxScore ||
              changes.movesCount! >= game.maxScoreMoves
            ) {
              changes.currScore = 0;
              changes.status = 'wrong-path';
              if (!prevState.wrongPath) {
                changes.wrongPath = true;
              }
            }
          } else {
            // The game is over
            if (changes.currScore === game.maxScore) {
              changes.status = 'win';
              playSound('win');
            } else {
              changes.status = 'lost';
              playSound('okay');
            }
          }

          return { ...prevState, ...changes, coins: newCoins };
        });
      } else if (state === 'none') {
        playSound('deny');
      }
    },
    [game, playSound]
  );

  return (
    <div className={styles['game-board']}>
      <BoardStatus
        maxScore={game.maxScore}
        currScore={gameState.currScore}
        status={gameState.status}
        boardScore={game.boardScore}
      />
      <div className={styles['coins-grid']} role='grid'>
        {gameState.coins.map((coin) => {
          return (
            <BoardCoin
              key={`coin-${coin.index}`}
              coin={coin}
              onClick={handleCoinClick}
            />
          );
        })}
      </div>
    </div>
  );
}
