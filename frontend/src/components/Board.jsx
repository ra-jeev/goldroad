import { useEffect, useState } from 'react';
import { FaRedo } from 'react-icons/fa';

import './Board.css';
import { Connection } from './Connection';
import { Tile } from './Tile';

export const Board = ({
  tiles,
  connections,
  state,
  onClick,
  currGame,
  lastGame,
}) => {
  const [tileSize, setTileSize] = useState('64px');

  useEffect(() => {
    if (tiles.length) {
      const windowWidth = window.innerWidth;
      const totalGap = (tiles.length - 1) * 8 + 2 * 16;

      if (windowWidth < tiles.length * 64 + totalGap) {
        const tSize = (windowWidth - totalGap) / tiles.length;
        setTileSize(`${tSize}px`);
      }
    }
  }, [tiles, tileSize]);

  const connectionPos = (row, col, dir) => {
    const divisor = 100 / tiles.length;
    const pos = {};
    if (dir === 'left') {
      pos.left = `calc(${col * divisor}% - 12px)`;
      pos.top = `calc(${(row + 0.5) * divisor}% - 12px)`;
    } else if (dir === 'right') {
      pos.left = `calc(${(col + 1) * divisor}% - 12px)`;
      pos.top = `calc(${(row + 0.5) * divisor}% - 12px)`;
    } else if (dir === 'top') {
      pos.left = `calc(${(col + 0.5) * divisor}% - 12px)`;
      pos.top = `calc(${row * divisor}% - 12px)`;
    } else if (dir === 'bottom') {
      pos.left = `calc(${(col + 0.5) * divisor}% - 12px)`;
      pos.top = `calc(${(row + 1) * divisor}% - 12px)`;
    }

    return pos;
  };

  const getOrdinal = (n) => {
    return ['st', 'nd', 'rd'][((((n + 90) % 100) - 10) % 10) - 1] || 'th';
  };

  return (
    <div className='board'>
      <div className='board-item board-info'>
        <span className='score'>
          Collect {state.max - state.score} coins {state.score > 0 && 'more'}
        </span>
        <span className='status'>{state.status}</span>
      </div>

      <div className='board-item'>
        <div className='tiles-wrapper'>
          {tiles.map((tilesRow, index) => {
            return (
              <div key={`row_${index}`}>
                {tilesRow.map((tile) => {
                  return (
                    <Tile
                      key={tile.id}
                      data={tile}
                      size={tileSize}
                      onClick={(id) => onClick('tile', id)}
                    />
                  );
                })}
              </div>
            );
          })}

          {connections.map((connectionsRow, row) => {
            return connectionsRow.map((connection, col) => {
              return (
                connection && (
                  <Connection
                    key={`conn_${row}${col}`}
                    dir={connection}
                    pos={connectionPos(row, col, connection)}
                  />
                )
              );
            });
          })}
        </div>
      </div>

      {state.moves ? (
        <div className='board-item'>
          <FaRedo className='redo' onClick={() => onClick('replay')} />
        </div>
      ) : (
        <div className='board-item status'>
          {lastGame &&
          lastGame.gameNo === currGame.gameNo &&
          !lastGame.solved &&
          lastGame.tries
            ? `${lastGame.tries + 1}${getOrdinal(lastGame.tries + 1)} try`
            : 'Begin by tapping the green coin'}
        </div>
      )}
    </div>
  );
};
