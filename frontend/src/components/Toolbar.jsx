import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  FaQuestionCircle,
  FaVolumeUp,
  FaVolumeMute,
  FaCoins,
  FaArrowLeft,
  FaChartBar,
  FaBars,
  FaSignInAlt,
  FaSignOutAlt,
} from 'react-icons/fa';

import { useFirebase } from '../providers/Firebase';
import { useAppData } from '../providers/AppData';
import './Toolbar.css';

const LAST_UPDATE = 'game-update-300323';

export const Toolbar = ({ onClick, sounds, toggleSound }) => {
  const menuListRef = useRef();
  const menuBtnRef = useRef();
  const [showMenu, setShowMenu] = useState(false);
  const [showDot, setShowDot] = useState(false);
  const location = useLocation();
  const showBack = location.pathname !== '/';
  const { gameId } = useParams();
  const { currGameNo } = useAppData();

  const { currentUserAuthInfo, signOutUser } = useFirebase();

  const changeSoundSetting = () => {
    const newValue = sounds === 'on' ? 'off' : 'on';
    toggleSound(newValue);
  };

  useEffect(() => {
    const updateShown = localStorage.getItem(LAST_UPDATE) || 'no';
    if (updateShown === 'no') {
      setShowDot(true);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === '/about' && showDot) {
      setShowDot(false);
      localStorage.setItem(LAST_UPDATE, 'yes');
    }
  }, [location.pathname, showDot]);

  const onMenuItemClick = (item) => {
    setShowMenu(false);
    if (
      item === 'sign-in' &&
      currentUserAuthInfo &&
      !currentUserAuthInfo.isAnonymous
    ) {
      signOutUser();
    } else {
      onClick(item);
    }
  };

  const handleClickOutside = (e) => {
    if (!menuListRef.current.contains(e.target)) {
      if (menuBtnRef.current.contains(e.target)) {
        setShowMenu(!showMenu);
      } else if (showMenu) {
        setShowMenu(false);
      }
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

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
          {currGameNo && (gameId || !showBack) && (
            <span
              className={`game-number${gameId ? ' game-number-silver' : ''}`}
            >
              #{currGameNo}
            </span>
          )}
        </div>
        {sounds === 'on' ? (
          <FaVolumeUp className='toolbar-icon' onClick={changeSoundSetting} />
        ) : (
          <FaVolumeMute className='toolbar-icon' onClick={changeSoundSetting} />
        )}
      </div>
      <div className='toolbar-icons-container'>
        <div className='icon-wrapper'>
          <FaQuestionCircle
            className='toolbar-icon'
            onClick={() => onClick('about')}
          />
          {showDot && <span className='notification-dot'></span>}
        </div>

        <FaChartBar className='toolbar-icon' onClick={() => onClick('stats')} />
        <div
          ref={menuBtnRef}
          className={`menu${showMenu ? ' menu-active' : ''}`}
        >
          <FaBars className='toolbar-icon' />
          <ul ref={menuListRef}>
            <li>
              <button type='button' onClick={() => onMenuItemClick('games')}>
                <FaCoins />
                Past roads
              </button>
            </li>
            <li>
              <button type='button' onClick={() => onMenuItemClick('sign-in')}>
                {!currentUserAuthInfo || currentUserAuthInfo.isAnonymous ? (
                  <>
                    <FaSignInAlt /> Sign in
                  </>
                ) : (
                  <>
                    <FaSignOutAlt /> Sign out
                  </>
                )}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
