import { useEffect, useState } from 'react';

import './Board.css';
import { Connection } from './Connection';
import { Tile } from './Tile';

const TILE_GAP = 8;
const CONN_OFFSET = parseInt((3 * TILE_GAP) / 2);

export const Board = ({ tiles, tileSize, connections, onClick }) => {
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
      <div className='tiles-wrapper'>
        {tiles.map((tilesRow, index) => {
          return (
            <div key={`row_${index}`}>
              {tilesRow.map((tile) => {
                return (
                  <Tile
                    key={tile.id}
                    data={tile}
                    size={tileSize && `${tileSize}px`}
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
  );
};
