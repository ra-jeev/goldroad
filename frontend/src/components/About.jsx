import './About.css';

export const About = () => {
  return (
    <div className='about-container'>
      <div className='about-section'>
        <div className='title'>How to play?</div>
        <p>
          <strong>Start with the green coin</strong>, and{' '}
          <strong>reach the red coin</strong> while collecting the maximum gold.
          There are many paths possible, choose one which gives you maximum
          gold.
        </p>
        <p>
          You can only go <strong>up / down</strong>, or{' '}
          <strong>left / right</strong>. Also, <strong>red dashed lines</strong>{' '}
          represent <strong>walls</strong> that you can't cross.
        </p>
        <p>
          <strong>Play as many times as you want.</strong> You win, if you get
          as much gold as is displayed at the start of the game.
        </p>
        <p>
          <strong>Try treading a new road everyday.</strong> The game refreshes
          everyday at <strong>12:00 AM GMT</strong>.
        </p>
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
          <a href='mailto:i.rarsh@gmail.com?subject=[GoldRoad]'>Contact me</a>
        </div>
      </div>
    </div>
  );
};
