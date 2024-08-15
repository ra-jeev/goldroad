import clsx from 'clsx';
import { formatQuantity } from '@/app/lib/utils';
import styles from '@/app/ui/stats/personal.module.css';

type StatsData = {
  currStreak: number;
  isCurrLongestStreak: boolean;
  longestStreak: number;
  played: number;
  solves: number;
  solveStats: { [key: string]: number };
};

export default function PersonalStats({
  playerStats,
}: {
  playerStats: StatsData;
}) {
  const formatPersonalStats = (statsData: StatsData) => {
    const completionRate = (statsData.solves / statsData.played) * 100;

    let totalTries = 0;
    let totalSolves = 0;
    Object.entries(statsData.solveStats).forEach(([tries, count]) => {
      totalTries += Number(tries) * count;
      totalSolves += count;
    });

    return [
      {
        key: 'Current Streak',
        value: formatQuantity(statsData.currStreak, 'day'),
      },
      {
        key: 'Longest Streak',
        value: statsData.isCurrLongestStreak
          ? 'This ☝️ one'
          : formatQuantity(statsData.longestStreak, 'day'),
      },
      {
        key: 'Total Treads',
        value: formatQuantity(statsData.played, 'road'),
      },
      {
        key: 'Total Finishes',
        value: formatQuantity(statsData.solves, 'road'),
      },
      {
        key: 'Completion Rate',
        value: `${completionRate.toFixed(0)}%`,
      },
      {
        key: 'Average Tries',
        value: formatQuantity(totalTries / totalSolves, 'try', 1),
      },
    ];
  };

  const personalStats = formatPersonalStats(playerStats);

  return (
    <div className={clsx('card', 'stats-card')}>
      <div className='card-title'>Your Stats</div>

      {personalStats.map((statItem, index) => {
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
