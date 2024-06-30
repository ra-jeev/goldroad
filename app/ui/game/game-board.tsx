'use client';

import { useState } from 'react';
import SoundManager from '@/app/lib/sound-manager';
import {
  Coin,
  CoinState,
  CoinWall,
  ConnectionDir,
  Game,
} from '@/app/lib/types';
import BoardCoin from '@/app/ui/game/board-coin';
import styles from '@/app/ui/game/game-board.module.css';
import GameStatus from '@/app/ui/game/game-status';

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

const INITIAL_GAME_STATE = {
  lastClickedIndex: -1,
  movesCount: 0,
  currScore: 0,
  wrongMove: false,
  status: '',
};

export default function GameBoard({ game }: { game: Game }) {
  const [coins, setCoins] = useState<Coin[]>(() =>
    game.coins.map((value, index) => ({
      index,
      value,
      isStart: game.start === index,
      isEnd: game.end === index,
      wall: game.walls[index] ?? CoinWall.None,
      state: game.start === index ? 'active' : 'none',
      tabIndex: game.start === index ? 0 : -1,
      connection: 'none',
      focus: false,
    }))
  );

  const [gameState, setGameState] = useState(() => {
    return {
      ...INITIAL_GAME_STATE,
      status: `Total coins on the board: ${game.boardScore}`,
    };
  });

  const gameColumns = game.cols;

  console.log('inside the game board component');
  const handleCoinClick = (index: number, state: CoinState) => {
    console.log('coin clicked:', index, 'state:', state);
    if (state === 'active') {
      SoundManager.play('coin');

      // Create a new coins array
      const newCoins = [...coins];

      // Replace the old coin with a new object
      const currCoin = coins[index];
      newCoins[index] = { ...currCoin, state: 'done', tabIndex: 0 };

      const changes: typeof INITIAL_GAME_STATE = {
        lastClickedIndex: index,
        currScore: gameState.currScore + currCoin.value,
        movesCount: gameState.movesCount + 1,
        wrongMove: false,
        status: `Total coins on the board: ${game.boardScore}`,
      };

      // find other currently active coins, and make them inactive
      if (gameState.lastClickedIndex !== -1) {
        const lastClickedIndex = gameState.lastClickedIndex;
        const direction = getConnectionDirection(
          lastClickedIndex,
          index,
          gameColumns
        );

        // Now we have a new lat clicked coin, so set this one's tabIndex -1
        newCoins[lastClickedIndex] = {
          ...coins[lastClickedIndex],
          tabIndex: -1,
          connection: direction,
        };

        handleNeighboringCoins(lastClickedIndex, newCoins, false, gameColumns);
      }

      if (!currCoin.isEnd) {
        // find the coins that should be active now
        const activeCoinsCount = handleNeighboringCoins(
          index,
          newCoins,
          true,
          gameColumns
        );

        if (!activeCoinsCount) {
          console.log('No further moves');
          changes.status = 'Uh Oh! No further moves...';
          changes.currScore = 0; // If no further moves possible, then reset the score to 0
          // changes.ended = true;
          SoundManager.play('noMoves');
        } else if (
          gameState.wrongMove ||
          changes.currScore >= game.maxScore ||
          changes.movesCount >= game.maxScoreMoves
        ) {
          changes.currScore = 0;
          changes.status = `This road feels unfamiliar...`;
          if (!gameState.wrongMove) {
            changes.wrongMove = true;
          }
        }
      } else {
        // The game is over
        if (changes.currScore === game.maxScore) {
          changes.status = "🏆 You've got the gold :-)";
          SoundManager.play('win');
        } else {
          if (game.maxScore - changes.currScore <= 3) {
            changes.status = `👏 That was close. Try again!`;
          } else {
            changes.status = '👻 Get some more coins. Try again!';
          }

          SoundManager.play('okay');
        }
      }

      setGameState({ ...gameState, ...changes });
      setCoins(newCoins);
    } else if (state === 'none') {
      SoundManager.play('deny');
    }
  };

  return (
    <div className={styles['game-board']}>
      <GameStatus
        maxScore={game.maxScore}
        currScore={gameState.currScore}
        status={gameState.status}
      />
      <div className={styles['coins-grid']} role='grid'>
        {coins.map((coin) => {
          return (
            <BoardCoin
              key={`coin-${coin.index}`}
              coin={coin}
              onClick={handleCoinClick}
            />
          );
        })}
      </div>
      <div></div>
    </div>
  );
}
