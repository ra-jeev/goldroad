'use client';

import { useState } from 'react';
import SoundManager from '@/app/lib/sound-manager';
import { Coin, CoinState, CoinWall, Game } from '@/app/lib/types';
import BoardCoin from '@/app/ui/game/board-coin';
import styles from '@/app/ui/game/game-board.module.css';

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
      focus: false,
    }))
  );
  const [lastClickedIndex, setLastClickedIndex] = useState(-1);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [currScore, setCurrScore] = useState(0);

  const changeCoinState = (coin: Coin | null, state: CoinState) => {
    if (coin && coin.state !== 'done') {
      coin.state = state;
    }
  };

  const handleNeighboringCoins = (
    currIndex: number,
    coins: Coin[],
    makeActive: boolean
  ) => {
    const currCoin = coins[currIndex];
    const topCoin =
      currIndex - game.cols >= 0 ? coins[currIndex - game.cols] : null;
    const bottomCoin =
      currIndex + game.cols < game.coins.length
        ? coins[currIndex + game.cols]
        : null;
    const leftCoin =
      currIndex % game.cols && currIndex - 1 >= 0 ? coins[currIndex - 1] : null;
    const rightCoin =
      (currIndex + 1) % game.cols !== 0 && currIndex + 1 < game.coins.length
        ? coins[currIndex + 1]
        : null;

    if (makeActive) {
      currCoin.state = 'done';
      currCoin.tabIndex = 0; // This is the new last interacted coin

      if (
        currCoin.wall !== CoinWall.Top &&
        topCoin &&
        topCoin.wall !== CoinWall.Bottom
      ) {
        changeCoinState(topCoin, 'active');
      }

      if (
        currCoin.wall !== CoinWall.Bottom &&
        bottomCoin &&
        bottomCoin.wall !== CoinWall.Top
      ) {
        changeCoinState(bottomCoin, 'active');
      }

      if (
        currCoin.wall !== CoinWall.Left &&
        leftCoin &&
        leftCoin.wall !== CoinWall.Right
      ) {
        changeCoinState(leftCoin, 'active');
      }

      if (
        currCoin.wall !== CoinWall.Right &&
        rightCoin &&
        rightCoin.wall !== CoinWall.Left
      ) {
        changeCoinState(rightCoin, 'active');
      }
    } else {
      changeCoinState(topCoin, 'none');
      changeCoinState(bottomCoin, 'none');
      changeCoinState(leftCoin, 'none');
      changeCoinState(rightCoin, 'none');
    }
  };

  const handleCoinClick = (index: number, state: CoinState) => {
    console.log('coin clicked:', index, 'state:', state);
    if (state === 'active') {
      SoundManager.play('coin');
      setCoins((prevCoins) => {
        const newCoins = [...prevCoins];

        // find other currently active coins, and make them inactive
        if (lastClickedIndex !== -1) {
          const lastClickedCoin = coins[lastClickedIndex];
          lastClickedCoin.tabIndex = -1; // Now we have a new lat clicked coin, so set this one's tabIndex -1
          handleNeighboringCoins(lastClickedIndex, newCoins, false);
        }

        const currCoin = coins[index];
        if (!currCoin.isEnd) {
          // find the coins that should be active now
          handleNeighboringCoins(index, coins, true);

          // set this index as the last clicked index
          setLastClickedIndex(index);
        } else {
          // The game is over
        }

        return newCoins;
      });
    } else if (state === 'none') {
      SoundManager.play('deny');
    }
  };

  return (
    <div className={styles['game-board']} role='grid'>
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
  );
}
