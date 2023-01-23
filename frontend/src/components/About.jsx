import step1 from '../assets/images/step-1.gif';
import step2 from '../assets/images/step-2.gif';
import step3 from '../assets/images/step-3.gif';
import step4 from '../assets/images/step-4.gif';
import step5 from '../assets/images/step-5.gif';
import step6 from '../assets/images/step-6.gif';
import './About.css';

export const About = () => {
  return (
    <div className='about-container'>
      <div className='about-section'>
        <div className='title'>How to play?</div>
        <figure>
          <figcaption>
            1. Start by <strong>tapping the green coin.</strong>
          </figcaption>
          <img src={step1} alt='starting coin animation' width={172} />
        </figure>
        <figure>
          <figcaption>
            2. Your goal is to <strong>reach the red coin</strong> by collecting
            the maximum possible coins (running counter shown above the game).
          </figcaption>
          <img src={step2} alt='final coin animation' width={172} />
        </figure>
        <figure>
          <figcaption>
            3. Every coin tap makes the neighboring coins (top-bottom &
            left-right) green, i.e. tappable.
          </figcaption>
          <img src={step3} alt='intermediate game board 1' width={172} />
        </figure>
        <figure>
          <figcaption>
            4. But if there is a <strong>wall</strong> in between (
            <strong>red dashed lines</strong>) then you won't be able to go in
            that direction.
          </figcaption>
          <img src={step4} alt='intermediate game board 2' width={172} />
        </figure>
        <figure>
          <figcaption>
            5. Some paths may lead to dead ends.{' '}
            <strong>Replay as many times you want</strong> by tapping the{' '}
            <strong>replay button</strong>.
          </figcaption>
          <img src={step5} alt='intermediate game board 3' width={172} />
        </figure>
        <figure>
          <figcaption>
            6. <strong>It may not be possible to collect all the coins</strong>{' '}
            present on the board.
          </figcaption>
          <img src={step6} alt='complete game play animation' width={172} />
        </figure>
        <figure>
          <figcaption>
            7. <strong>Comeback tomorrow for a new puzzle.</strong> The game
            refreshes everyday at <strong>12:00 AM GMT</strong>.
          </figcaption>
        </figure>
      </div>
      <div className='about-section'>
        <div className='title'>About</div>
        <p>
          I created this little puzzle game as part of a hackathon. The half
          formed idea was there in mind for quite some time, the hackathon
          provided the urgency it needed :-)
        </p>
      </div>
      <div className='about-footer'>
        <div style={{ marginBottom: '1rem' }}>
          Follow GoldRoad on Twitter{' '}
          <a
            href='https://twitter.com/thegoldroad'
            target='_blank'
            rel='noreferrer'
          >
            @TheGoldRoad
          </a>
        </div>

        <div>
          Made with ❤️ & coffee, by{' '}
          <a
            href='https://twitter.com/ra_jeeves'
            target='_blank'
            rel='noreferrer'
          >
            @ra_jeeves
          </a>
        </div>
        <div>
          For feedback, or anything else{' '}
          <a href='mailto:i.rarsh@gmail.com?subject=[GoldRoad]'>Contact me</a>
        </div>
      </div>
    </div>
  );
};
