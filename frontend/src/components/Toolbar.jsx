import { FaQuestionCircle, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

import './Toolbar.css';

export const Toolbar = ({ sounds, gameNo, onClick }) => {
  return (
    <div className='toolbar'>
      <div>
        <span className='logo' onClick={() => onClick('logo')}>
          GoldRoad
        </span>
        <span className='game-number'>#{gameNo}</span>
      </div>
      <div className='toolbar-icons-container'>
        <FaQuestionCircle
          className='toolbar-icon'
          onClick={() => onClick('about')}
        />
        {sounds === 'on' ? (
          <FaVolumeUp
            className='toolbar-icon'
            onClick={() => onClick('sounds')}
          />
        ) : (
          <FaVolumeMute
            className='toolbar-icon'
            onClick={() => onClick('sounds')}
          />
        )}
      </div>
    </div>
  );
};
