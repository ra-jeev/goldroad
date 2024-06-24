import clsx from 'clsx';
import styles from '@/app/ui/game/board-coin.module.css';
import { Coin, CoinWall } from '@/app/lib/types';

export default function BoardCoin({ coin }: { coin: Coin }) {
  return (
    <div
      className={clsx(styles.coin, {
        [styles['wall-left']]: coin.wall === CoinWall.LEFT,
        [styles['wall-eight']]: coin.wall === CoinWall.RIGHT,
        [styles['wall-top']]: coin.wall === CoinWall.TOP,
        [styles['wall-bottom']]: coin.wall === CoinWall.BOTTOM,
      })}
    >
      <div className={styles['coin-border']} />
      {coin.value}
    </div>
  );
}
