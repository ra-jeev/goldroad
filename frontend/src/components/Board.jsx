import { useEffect, useState } from 'react';

import './Board.css';
import { Connection } from './Connection';
import { Tile } from './Tile';

const TILE_SIZE = 64;
const TILE_GAP = 8;
const CONN_OFFSET = parseInt((3 * TILE_GAP) / 2);

export const Board = ({ tiles, connections, onClick }) => {
  const [tileSize, setTileSize] = useState(TILE_SIZE);

  useEffect(() => {
    if (tiles.length) {
      const windowWidth = window.innerWidth;
      const totalGap = (tiles.length - 1) * TILE_GAP + 2 * (2 * TILE_GAP);

      if (windowWidth < tiles.length * TILE_SIZE + totalGap) {
        const tSize = (windowWidth - totalGap) / tiles.length;
        setTileSize(tSize);
      }
    }
  }, [tiles]);

  const connectionPos = (row, col, dir) => {
    const divisor = 100 / tiles.length;
    const pos = {};
    if (dir === 'left') {
      pos.left = `calc(${col * divisor}% - ${CONN_OFFSET}px)`;
      pos.top = `calc(${(row + 0.5) * divisor}% - ${CONN_OFFSET}px)`;
    } else if (dir === 'right') {
      pos.left = `calc(${(col + 1) * divisor}% - ${CONN_OFFSET}px)`;
      pos.top = `calc(${(row + 0.5) * divisor}% - ${CONN_OFFSET}px)`;
    } else if (dir === 'top') {
      pos.left = `calc(${(col + 0.5) * divisor}% - ${CONN_OFFSET}px)`;
      pos.top = `calc(${row * divisor}% - ${CONN_OFFSET}px)`;
    } else if (dir === 'bottom') {
      pos.left = `calc(${(col + 0.5) * divisor}% - ${CONN_OFFSET}px)`;
      pos.top = `calc(${(row + 1) * divisor}% - ${CONN_OFFSET}px)`;
    }

    return pos;
  };

  return (
    <div className='board'>
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
                      size={`${tileSize}px`}
                      onClick={(id) => onClick(id)}
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
    </div>
  );
};
