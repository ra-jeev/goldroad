import styles from '@/app/ui/game/game-status.module.css';

export default function GameStatus({
  maxScore,
  currScore,
  status,
}: {
  maxScore: number;
  currScore: number;
  status: string;
}) {
  return (
    <div className={styles['info-container']}>
      <span className={styles['score-details']}>
        Collect {maxScore - currScore} coins
        {currScore > 0 ? ' more' : ' in your path'}
      </span>
      <span className={styles.status}>{status}</span>
    </div>
  );
}
