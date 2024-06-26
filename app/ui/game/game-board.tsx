'use client';

import { useState } from 'react';
import { Coin, CoinWall, Game } from '@/app/lib/types';
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

  const handleCoinCollect = (index: number) => {
    console.log('coin clicked', index);
    const clickedCoin = coins[index];
    if (clickedCoin.state === 'active') {
      setCoins((prevCoins) => {
        const newCoins = [...prevCoins];
        const nextIndex = (index + 1) % newCoins.length; // Example: Make the next coin active
        newCoins[nextIndex].active = true;
        return newCoins;
      });
    } else if (clickedCoin.state === 'none') {
    }
  };

  return (
    <div className={styles['game-board']} role='grid'>
      {coins.map((coin) => {
        return (
          <BoardCoin
            key={`coin-${coin.index}`}
            coin={coin}
            onClick={handleCoinCollect}
          />
        );
      })}
      <audio ref='audio' preload='auto'>
        <source src='audioUrl' type='audio/mp3' />
      </audio>
    </div>
  );
}
