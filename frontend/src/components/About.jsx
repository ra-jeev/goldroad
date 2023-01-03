import begin from '../assets/media/images/begin.png';
import end from '../assets/media/images/end.png';
import intermediate1 from '../assets/media/images/intermediate-1.png';
import intermediate2 from '../assets/media/images/intermediate-2.png';
import intermediate3 from '../assets/media/images/intermediate-3.png';
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
          <img src={begin} alt='starting coin' width={80} />
        </figure>
        <figure>
          <figcaption>
            2. Your goal is to <strong>reach the red coin</strong> by collecting
            the maximum possible coins (running counter shown above the game).
          </figcaption>
          <img src={end} alt='final coin' width={40} />
        </figure>
        <figure>
          <figcaption>
            3. Every coin tap makes the neighboring coins (in up-down &
            left-right directions) green, i.e. tappable.
          </figcaption>
          <img src={intermediate1} alt='intermediate game board' width={120} />
        </figure>
        <figure>
          <figcaption>
            4. But if there is a <strong>wall</strong> in between (
            <strong>red dashed lines</strong>) then you won't be able to go in
            that direction.
          </figcaption>
          <img
            src={intermediate2}
            alt='alternative intermediate game board'
            width={120}
          />
        </figure>
        <figure>
          <figcaption>
            5. Some paths may lead to dead ends, or lesser number of coins.{' '}
            <strong>
              To win, get to the red coin with the needed number of coins.
            </strong>
          </figcaption>
          <img
            src={intermediate3}
            alt='intermediate game board with path'
            width={120}
          />
        </figure>
        <figure>
          <figcaption>
            6. <strong>Play as many times as you want.</strong>
          </figcaption>
        </figure>
        <figure>
          <figcaption>
            7. <strong>Comeback tomorrow for a new puzzle.</strong> The game
            refreshes everyday at <strong>12:00 AM GMT</strong>
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
