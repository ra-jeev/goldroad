import { Game } from '@/app/lib/types';
import BoardCoin from '@/app/ui/game/board-coin';
import styles from '@/app/ui/game/game-board.module.css';

export default function Board({ game }: { game: Game }) {
  return (
    <div className={styles['game-board']}>
      {game.coins.map((coin, index) => {
        return <BoardCoin key={`coin-${index}`} coin={coin} />;
      })}
    </div>
  );
}
