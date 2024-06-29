import { memo } from 'react';
import clsx from 'clsx';
import styles from '@/app/ui/game/board-coin.module.css';
import { Coin, CoinState, CoinWall } from '@/app/lib/types';

const BoardCoin = ({
  coin,
  onClick,
}: {
  coin: Coin;
  onClick: (index: number, state: CoinState) => void;
}) => {
  return (
    <button
      className={clsx(styles.coin, {
        [styles['wall-left']]: coin.wall === CoinWall.Left,
        [styles['wall-right']]: coin.wall === CoinWall.Right,
        [styles['wall-top']]: coin.wall === CoinWall.Top,
        [styles['wall-bottom']]: coin.wall === CoinWall.Bottom,
        [styles['coin--start']]: coin.isStart,
        [styles['coin--end']]: coin.isEnd,
        [styles['coin--active']]: coin.state === 'active',
        [styles['coin--done']]: coin.state === 'done',
      })}
      type='button'
      role='gridcell'
      tabIndex={coin.tabIndex}
      onClick={() => onClick(coin.index, coin.state)}
    >
      <div className={styles['coin-border']} />
      {coin.value}
    </button>
  );
};

export default memo(BoardCoin, (prevProps, nextProps) => {
  return (
    prevProps.coin.tabIndex === nextProps.coin.tabIndex &&
    prevProps.coin.state === nextProps.coin.state
  );
});
