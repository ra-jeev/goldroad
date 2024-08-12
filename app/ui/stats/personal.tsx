import clsx from 'clsx';
import styles from '@/app/ui/stats/personal.module.css';

type StatItem = {
  key: string;
  value: string;
};

export default function PersonalStats({
  overallStats,
}: {
  overallStats: StatItem[];
}) {
  return (
    <div className={clsx('card', 'stats-card')}>
      <div className='card-title'>Your Stats</div>
      {overallStats.map((statItem, index) => {
        return (
          <div key={`personal-stats-${index}`} className={styles.statsEntry}>
            <div className={styles.statsKey}>{statItem.key}:</div>
            <div className={styles.statsVal}>{statItem.value}</div>
          </div>
        );
      })}
    </div>
  );
}
