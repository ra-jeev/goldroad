import { useEffect } from 'react';

import { Connection } from './Connection';
import { Tile } from './Tile';
import './Board.css';

const TILE_GAP = 8;
const CONN_OFFSET = parseInt((3 * TILE_GAP) / 2);

export const Board = ({
  tiles,
  tileSize,
  connections,
  onClick,
  keyboardEventListener,
}) => {
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

  const onKeyboardEvent = (event) => {
    const target = event.target || event.srcElement;
    if (target.getAttribute('role') !== 'gridcell' || !keyboardEventListener) {
      return;
    }

    let row = parseInt(target.dataset.row);
    let col = parseInt(target.dataset.col);

    switch (event.keyCode) {
      case 37: // left
        if (col > 0) {
          keyboardEventListener({
            curr: { row, col },
            next: { row, col: col - 1 },
          });
        }
        break;
      case 38: // top
        if (row > 0) {
          keyboardEventListener({
            curr: { row, col },
            next: { row: row - 1, col },
          });
        }
        break;
      case 39: // right
        if (col < tiles[0].length - 1) {
          keyboardEventListener({
            curr: { row, col },
            next: { row, col: col + 1 },
          });
        }
        break;
      case 40: // bottom
        if (row < tiles.length - 1) {
          keyboardEventListener({
            curr: { row, col },
            next: { row: row + 1, col },
          });
        }
        break;
      default:
        // nothing to do here
        return;
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', onKeyboardEvent);

    return () => document.removeEventListener('keydown', onKeyboardEvent);
  });

  return (
    <div className='board' role='grid'>
      <div className='tiles-wrapper' role='rowgroup'>
        {tiles.map((tilesRow, index) => {
          return (
            <div key={`row_${index}`} role='row'>
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
