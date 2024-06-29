import { memo } from 'react';
import clsx from 'clsx';
import { Coin, CoinState, CoinWall } from '@/app/lib/types';
import styles from '@/app/ui/game/board-coin.module.css';

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
      <span>{coin.value}</span>
      {coin.connection !== 'none' && (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 448 512'
          className={clsx(styles.arrow, styles[`arrow--${coin.connection}`])}
        >
          <path d='M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z'></path>
        </svg>
      )}
    </button>
  );
};

export default memo(BoardCoin, (prevProps, nextProps) => {
  return (
    prevProps.coin.tabIndex === nextProps.coin.tabIndex &&
    prevProps.coin.state === nextProps.coin.state &&
    prevProps.coin.focus === nextProps.coin.focus &&
    prevProps.coin.connection === nextProps.coin.connection
  );
});
