import { useLocation, useParams } from 'react-router-dom';
import {
  FaQuestionCircle,
  FaVolumeUp,
  FaVolumeMute,
  FaCoins,
  FaArrowLeft,
  FaChartBar,
} from 'react-icons/fa';

import './Toolbar.css';

export const Toolbar = ({ sounds, gameNo, onClick }) => {
  const location = useLocation();
  const showBack = location.pathname !== '/';
  const { gameId } = useParams();

  return (
    <div className='toolbar'>
      <div className='toolbar-icons-container'>
        {showBack && (
          <FaArrowLeft className='back-btn' onClick={() => onClick('back')} />
        )}
        <div>
          <span className='logo' onClick={() => onClick('logo')}>
            GoldRoad
          </span>
          {gameNo && (gameId || !showBack) && (
            <span
              className={`game-number${gameId ? ' game-number-silver' : ''}`}
            >
              #{gameNo}
            </span>
          )}
        </div>
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
      <div className='toolbar-icons-container'>
        <FaQuestionCircle
          className='toolbar-icon'
          onClick={() => onClick('about')}
        />
        <FaCoins className='toolbar-icon' onClick={() => onClick('games')} />
        <FaChartBar className='toolbar-icon' onClick={() => onClick('stats')} />
      </div>
    </div>
  );
};
