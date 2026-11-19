import type { Board } from '#shared/types/game';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getMoveScore,
} from '#shared/utils/puzzleEngine';

export function restoreRoadRoute(board: Board, path: readonly number[]) {
  if (path[0] !== board.start || path.length > board.tiles.length) return null;

  const edgeMap = buildEdgeMap(board);
  const visited = new Set([board.start]);
  let current = board.start;
  let score = board.tiles[current] ?? 0;
  let neighbors = getActiveNeighbors(
    current,
    board.rows,
    board.cols,
    edgeMap,
    visited,
  );

  for (const tile of path.slice(1)) {
    if (tile === board.end || !neighbors.includes(tile)) return null;

    score += getMoveScore(board, edgeMap, current, tile);
    current = tile;
    visited.add(tile);
    neighbors = getActiveNeighbors(
      current,
      board.rows,
      board.cols,
      edgeMap,
      visited,
    );
  }

  if (path.length > 1 && neighbors.length === 0) return null;
  return { current, score, visited, neighbors };
}
