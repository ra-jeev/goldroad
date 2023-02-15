import { Link } from 'react-router-dom';

import { HowToPlay } from './HowToPlay';
import './About.css';

export const About = () => {
  return (
    <div className='about-container'>
      <div className='about-section'>
        <div className='title'>How to play?</div>
        <HowToPlay />
        <div className='play-game-link'>
          <Link className='about-link ' to='/'>
            Walk down today's road
          </Link>
          <br />
          <br />
          <Link className='about-link ' to='/games'>
            Looking for past roads?
          </Link>
        </div>
      </div>

      <div className='about-section'>
        <div className='title'>About</div>
        <p>
          I created this little puzzle game as part of a hackathon. The half
          formed idea was there in mind for quite some time, the hackathon
          provided the urgency it needed :-).
        </p>
        <p>
          I was mainly inspired by the Figure game (by{' '}
          <a
            className='about-link'
            href='https://twitter.com/sumul'
            target='_blank'
            rel='noreferrer'
          >
            @sumul
          </a>
          ) which I'm still a regular player of.
        </p>
        <p>
          I hope that you've as much fun playing this game as I had creating it.
          If you've any feedback, or want to get in touch with me, please use
          the links at the bottom of this page.
        </p>
      </div>
      <div className='about-section'>
        <div className='title'>Privacy Policy</div>
        <p>
          The game's privacy policy is very simple. I use a privacy first
          analytics tool Umami for keeping track of general game performance and
          any issues. No private information is collected from you.
        </p>
        <p>
          Your email address (should you choose to sign in) is used to merge
          your playing history across different browsers on your phone / laptop.
        </p>
      </div>
      <div className='about-footer'>
        <div style={{ marginBottom: '1rem' }}>
          Follow GoldRoad on Twitter{' '}
          <a
            className='about-link'
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
            className='about-link'
            href='https://twitter.com/ra_jeeves'
            target='_blank'
            rel='noreferrer'
          >
            @ra_jeeves
          </a>
        </div>
        <div>
          For feedback, or anything else{' '}
          <a
            className='about-link'
            href='mailto:i.rarsh@gmail.com?subject=[GoldRoad]'
          >
            Contact me
          </a>
        </div>
      </div>
    </div>
  );
};
