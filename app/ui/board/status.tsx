import type { PlayStatus } from '@/app/lib/types';
import styles from '@/app/ui/board/status.module.css';

export default function BoardStatus({
  maxScore,
  currScore,
  status,
  boardScore,
}: {
  maxScore: number;
  currScore: number;
  status: PlayStatus;
  boardScore: number;
}) {
  const playStatus = () => {
    switch (status) {
      case 'initial':
        return `Total ${boardScore} coins on the board`;
      case 'playing':
        return `${boardScore - currScore} coins remain on the board`;
      case 'no-moves':
        return 'Uh Oh! No further moves...';
      case 'wrong-path':
        return 'This road feels unfamiliar...';
      case 'lost':
        if (maxScore - currScore! <= 3) {
          return `👏 That was close. Try again!`;
        } else {
          return '👻 Get some more coins. Try again!';
        }
      case 'win':
        return "🏆 You've got the gold :-)";
    }
  };

  return (
    <div className={styles['info-container']}>
      <span className={styles['score-details']}>
        Collect {maxScore - currScore} coins
        {currScore > 0 ? ' more' : ' in your path'}
      </span>
      <span className={styles.status}>{playStatus()}</span>
    </div>
  );
}
