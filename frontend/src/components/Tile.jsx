import { useEffect, useRef, useState } from 'react';

import './Tile.css';

const WALLS_MAP = {
  1: 'top',
  2: 'right',
  3: 'bottom',
  4: 'left',
};

export const Tile = ({ data, size, onClick }) => {
  const { id, value, wall, active, end, done, start, tabIndex, focus } = data;
  const [tileClasses, setTileClasses] = useState('tile');
  const btnRef = useRef();

  useEffect(() => {
    const classes = ['tile'];

    if (focus) {
      btnRef.current.focus();
    }

    if (Object.keys(WALLS_MAP).includes(`${wall}`)) {
      classes.push(`wall-${WALLS_MAP[wall]}`);
    }

    if (end) {
      classes.push('tile--end');
    }

    if (active) {
      classes.push('tile--active');
    }

    if (done) {
      if (!tileClasses.includes('tile--done')) {
        classes.push('tile--tapped');
        setTileClasses(classes.join(' '));
        const timer = setTimeout(() => {
          classes.splice(classes.length - 1, 1, 'tile--done');
          if (start) {
            classes.push('flag--start');
          } else if (end) {
            classes.push('flag--end');
          }
          setTileClasses(classes.join(' '));
        }, 200);

        return () => {
          clearTimeout(timer);
        };
      }
    } else {
      setTileClasses(classes.join(' '));
    }
  }, [wall, active, start, end, done, tileClasses, focus]);

  const onTileClick = (event) => {
    event.preventDefault();
    onClick(id);
  };

  return (
    <button
      ref={btnRef}
      data-row={id[0]}
      data-col={id[1]}
      type='button'
      role='gridcell'
      className={tileClasses}
      onClick={onTileClick}
      style={size && { width: size, height: size }}
      tabIndex={tabIndex}
    >
      <div className='border-div' />
      <span>{value}</span>
    </button>
  );
};
