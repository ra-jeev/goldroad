import { useEffect, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';

import { HowToPlay } from './HowToPlay';
import './HowToPlayDialog.css';

export const HowToPlayDialog = ({ onClose }) => {
  const dialogRef = useRef();

  const handleClickOutside = (e) => {
    if (!dialogRef.current.contains(e.target)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <div className='how-to-overlay'>
      <div ref={dialogRef} className='how-to-container'>
        <div className='how-to-title'>How to play?</div>
        <FaTimes className='how-to-close' onClick={onClose} />
        <div className='how-to-play'>
          <HowToPlay />
        </div>
      </div>
    </div>
  );
};
