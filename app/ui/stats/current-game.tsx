import clsx from 'clsx';
import { formatQuantity, getEmojiForTries } from '@/app/lib/utils';
import PlayTodaysGameBtn from '@/app/ui/play-todays-game-btn';
import ShareBtn from '@/app/ui/share-btn';
import styles from '@/app/ui/stats/current-game.module.css';

export default function CurrentGameStats({
  gameNo,
  tries,
  solved,
}: {
  gameNo: number;
  tries: number;
  solved: boolean;
}) {
  const shareText = `@TheGoldRoad\nGoldRoad #${gameNo}\n${getEmojiForTries(
    tries
  )} ${formatQuantity(
    tries,
    'try'
  )}\n#GoldRoad #GoldRoad${gameNo}\n\nPlay now: https://playgoldroad.com`;

  return (
    <div className='card stats-card'>
      <div className='card-title'>Today&apos;s Road</div>
      {solved ? (
        <>
          <p className='text-lg mt-2'>
            Yay! You got to the finish line{' '}
            <span className='emoji-medium'>🎉</span>
          </p>
          <div className={clsx('mt-6', styles.statsText)}>
            <div>@TheGoldRoad</div>

            <div>
              GoldRoad #{gameNo}
              <br />
              <span className='emoji-medium'>
                {getEmojiForTries(tries)}
              </span>{' '}
              {formatQuantity(tries, 'try')}
              <br />
              #GoldRoad #GoldRoad{gameNo}
            </div>

            <span>https://playgoldroad.com</span>
          </div>
          <ShareBtn className='mt-6' shareText={shareText} />
        </>
      ) : (
        <>
          <p className='text-lg mt-2'>
            Umm...you haven&apos;t {tries ? 'completed it' : 'walked down'} yet!
          </p>
          <PlayTodaysGameBtn className='mt-8' />
        </>
      )}
    </div>
  );
}
