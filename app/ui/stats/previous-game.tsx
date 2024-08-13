import clsx from 'clsx';
import { GameStats } from '@/app/lib/types';
import { formatQuantity } from '@/app/lib/utils';
import styles from '@/app/ui/stats/previous-game.module.css';

type Stats = {
  averageTries: number;
  solvePercent: number;
  topPercentile?: number;
  distributions: { key: string; value: number; highlight?: boolean }[];
  tries: number;
};

const UPPER_BOUND = 25;

export default function PreviousGameStats({
  gameStats,
  playerStats,
}: {
  gameStats: GameStats;
  playerStats?: { tries: number; solved: boolean };
}) {
  const calculateStats = (): Stats => {
    const { played, solved, tries } = gameStats.stats;

    let totalTries = 0;
    let twentyFivePlusTries = 0;
    Object.entries(tries).forEach(([tries, count]) => {
      totalTries += Number(tries) * count;
      if (Number(tries) >= UPPER_BOUND) {
        twentyFivePlusTries += count;
      }
    });

    // Calculate average tries
    const averageTries = totalTries / solved;

    // Calculate solve percentage
    const solvePercent = (solved / played) * 100;

    // Maximum number of players for any try count
    const maxPlayersForAnyTry = Math.max(
      ...Object.values(tries),
      twentyFivePlusTries
    );

    // Calculate distributions
    const distributions = Array.from({ length: UPPER_BOUND }, (_, i) => {
      let key = String(i + 1);
      let value = tries[key] ? (tries[key] / maxPlayersForAnyTry) * 100 : 1; // minimum 1% bar height

      if (i === UPPER_BOUND - 1) {
        key = `${UPPER_BOUND}+`;
        value = twentyFivePlusTries
          ? (twentyFivePlusTries / maxPlayersForAnyTry) * 100
          : 1;
      }

      return {
        key,
        value,
        highlight: false,
      };
    });

    // Calculate top percentile for the player
    let topPercentile;
    if (playerStats?.solved) {
      const playersTaken = Object.entries(tries).reduce(
        (sum, [triesStr, count]) => {
          return Number(triesStr) <= playerStats.tries ? sum + count : sum;
        },
        0
      );
      topPercentile = (playersTaken / played) * 100;

      const playerTriesIndex = Math.min(playerStats.tries - 1, UPPER_BOUND - 1);
      distributions[playerTriesIndex].highlight = true;
    }

    return {
      averageTries,
      solvePercent,
      topPercentile,
      distributions,
      tries: playerStats?.tries ?? 0,
    };
  };

  const stats = calculateStats();

  return (
    <div className='card stats-card'>
      <div className='card-title'>
        Yesterday&apos;s Road: #{gameStats.gameNo}
      </div>
      <div className='text-lg mt-2'>Global Stats</div>

      <div className={clsx('mt-8', styles.graphContainer)}>
        <div className={styles.graphPlot}>
          {stats.distributions.map((entry, index) => {
            return (
              <div
                key={`try_${index}`}
                className={clsx(
                  styles.graphBar,
                  entry.highlight && styles.highlight
                )}
                style={{
                  height: `${entry.value}%`,
                }}
              >
                {([0, UPPER_BOUND - 1].includes(index) ||
                  (entry.highlight && index !== UPPER_BOUND - 2)) && (
                  <span className={styles.axisMarker}>{entry.key}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className={styles.graphLabel}>
          tries <strong>→</strong>
        </div>
      </div>
      <div className={clsx('mt-6', styles.globalStatsText)}>
        <p>
          <strong>{stats.solvePercent.toFixed(0)}%</strong> of the people who
          walked down <strong>GoldRoad #{gameStats.gameNo}</strong> finished it.
          On an average it took them{' '}
          <strong>{formatQuantity(stats.averageTries, 'try', 1)}</strong>.
        </p>
        {stats.topPercentile ? (
          <p>
            You got to the finish line in{' '}
            <strong>{formatQuantity(stats.tries, 'try')}</strong>, which was in
            the top <strong>{stats.topPercentile.toFixed(0)}%</strong> of the
            people who walked down the road.
          </p>
        ) : (
          <p>
            Walk down today&apos;s road, and come back here tomorrow to see how
            you fared against others.
          </p>
        )}
      </div>
    </div>
  );
}
