import Link from 'next/link';
import HowToPlay from '@/app/ui/how-to-play';
import AppFooter from '@/app/ui/app-footer';
import styles from '@/app/about/page.module.css';

export default function Page() {
  return (
    <>
      <div className='section'>
        <div className='title'>Updates</div>
        <div className={styles.update}>
          <div className={styles.date}>
            <strong>Mar 30, 2023</strong>
          </div>
          <p>
            Going forward, you can see the total value of the coins present on
            the board just below the max score.
          </p>
        </div>

        <div className={styles.update}>
          <div className={styles.date}>
            <strong>Mar 24, 2023</strong>
          </div>
          <p>Now you can walk down the road using your keyboard.</p>
          <p>
            Press{' '}
            <kbd className={styles.kbd}>
              <strong>tab</strong>
            </kbd>{' '}
            (or{' '}
            <kbd className={styles.kbd}>
              <strong>option + tab</strong>
            </kbd>{' '}
            for Safari) to start keyboard navigation, and then use the arrow
            keys to move vertically or horizontally.
          </p>
          <p>
            Press{' '}
            <kbd className={styles.kbd}>
              <strong>space</strong>
            </kbd>{' '}
            or{' '}
            <kbd className={styles.kbd}>
              <strong>return</strong>
            </kbd>{' '}
            to click a coin.
          </p>
          <p>
            To replay, just press{' '}
            <kbd className={styles.kbd}>
              <strong>tab</strong>
            </kbd>{' '}
            and then press{' '}
            <kbd className={styles.kbd}>
              <strong>return</strong>
            </kbd>
            .
          </p>
        </div>
      </div>

      <div className='section'>
        <div className='title'>How to play?</div>
        <HowToPlay />
      </div>

      <div className='section'>
        <div className='title'>Get going</div>
        <p>
          Walk down <Link href='/'>today&apos;s road</Link>
        </p>
        <p>
          Or, you can explore <Link href='/games'>past roads</Link>
        </p>
      </div>

      <div className='section'>
        <div className='title'>About</div>
        <p>
          I created this little puzzle game as part of a hackathon. The half
          formed idea was there in mind for quite some time, the hackathon
          provided the urgency it needed :-).
        </p>
        <p>
          I was mainly inspired by the Figure game (by{' '}
          <a href='https://twitter.com/sumul' target='_blank' rel='noreferrer'>
            @sumul
          </a>
          ) which I&apos;m still a regular player of.
        </p>
        <p>
          I hope that you&apos;ve as much fun playing this game as I had
          creating it. If you&apos;ve any feedback, or want to get in touch with
          me, please use the links at the bottom of this page.
        </p>
      </div>

      <div className='section'>
        <div className='title'>Privacy Policy</div>
        <p>
          The game&apos;s privacy policy is very simple. I use a privacy first
          analytics tool Umami for keeping track of general game performance and
          any issues. No private information is collected from you.
        </p>
        <p>
          Your email address (should you choose to sign in) is used to merge
          your playing history across different browsers on your phone / laptop.
        </p>
      </div>

      <AppFooter />
    </>
  );
}
