import Image from 'next/image';

export default function HowToPlay() {
  return (
    <div>
      <figure>
        <figcaption>
          1. Start by <strong>tapping the green coin.</strong>
        </figcaption>
        <Image
          src='/images/step-1.gif'
          width={301}
          height={294}
          alt='Game start animation'
        />
      </figure>
      <figure>
        <figcaption>
          2. Your goal is to <strong>reach the red coin</strong> by collecting
          the maximum possible coins (running counter shown above the game
          board).
        </figcaption>
        <Image
          src='/images/step-2.gif'
          width={301}
          height={353}
          alt='Game end animation'
        />
      </figure>
      <figure>
        <figcaption>
          3. Every coin tap makes the neighboring coins (top-bottom &
          left-right) green, i.e. tappable.
        </figcaption>
        <Image
          src='/images/step-3.gif'
          width={301}
          height={294}
          alt='intermediate game board state display'
        />
      </figure>
      <figure>
        <figcaption>
          4. But if there is a <strong>wall</strong> in between (
          <strong>red dashed lines</strong>) then you can&apos;t go in that
          direction.
        </figcaption>
        <Image
          src='/images/step-4.gif'
          width={301}
          height={294}
          alt='Intermediate game board stat with wall'
        />
      </figure>
      <figure>
        <figcaption>
          5. Some paths may lead to dead ends.{' '}
          <strong>You can replay as many times you want</strong> by tapping the{' '}
          <strong>replay button</strong>.
        </figcaption>
        <Image
          src='/images/step-5.gif'
          width={301}
          height={356}
          alt='intermediate game board state with a dead-end'
        />
      </figure>
      <figure>
        <figcaption>
          6. <strong>It may not be possible to collect all the coins</strong>{' '}
          present on the board.
        </figcaption>
        <Image
          src='/images/step-6.gif'
          width={301}
          height={295}
          alt='Complete end to end game play'
        />
      </figure>
      <figure>
        <figcaption>
          7. <strong>Comeback tomorrow for a new puzzle.</strong> There is a new
          road available to walk on everyday at <strong>12:00 AM GMT</strong>.
        </figcaption>
      </figure>
    </div>
  );
}
