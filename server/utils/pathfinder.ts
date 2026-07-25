/**
 * Exhaustive BFS path finder — server-side only.
 *
 * Finds the highest-value route from Board.start to Board.end respecting
 * all edge constraints. Used by:
 *   • The puzzle generator (to compute maxScore and optimalPaths at creation time).
 *   • The hint endpoint (to compute the stored optimalPaths for a given game).
 *
 * Complexity note:
 *   This enumerates EVERY simple route, so cost tracks the number of simple
 *   paths in the graph, not the board size. Measured on 6×6 boards: 9,000 to
 *   15,000+ routes and 55 ms to 13.5 s for a single call, with expedition the
 *   slow case because it blocks fewer edges and so leaves a more open graph.
 *   An earlier note here claimed "<50 ms", which is not true of the tail.
 *   There is no job cap or time budget; callers that run this in a request
 *   path need to add one.
 *
 *   Each BFS job carries only a Set<number> of visited tile ids and a path
 *   array, not a clone of the full board — significantly lighter than v1.
 */

import type { Board, PathResult } from '../../shared/types/game';
import {
  buildEdgeMap,
  getActiveNeighbors,
  getEdgeType,
} from '../../shared/utils/puzzleEngine';

interface PathJob {
  currentId: number;
  visited: Set<number>;
  path: number[];
  total: number;
}

/**
 * Finds all valid paths from start to end, calculating total score
 * including tile values and edge modifiers (tolls/bonuses).
 */
export function findAllRoutes(board: Board): PathResult[] {
  const edgeMap = buildEdgeMap(board);
  const startTileValue = board.tiles[board.start];

  if (startTileValue === undefined) return [];

  const jobs: PathJob[] = [
    {
      currentId: board.start,
      visited: new Set([board.start]),
      path: [board.start],
      total: startTileValue,
    },
  ];

  const results: PathResult[] = [];

  while (jobs.length > 0) {
    const job = jobs.shift()!;

    if (job.currentId === board.end) {
      results.push({
        total: job.total,
        moves: job.path.length,
        path: job.path,
      });
      continue;
    }

    const neighbors = getActiveNeighbors(
      job.currentId,
      board.rows,
      board.cols,
      edgeMap,
      job.visited,
    );

    for (const nId of neighbors) {
      const neighborValue = board.tiles[nId];
      if (neighborValue === undefined) continue;

      const type = getEdgeType(job.currentId, nId, edgeMap);
      let modifier = 0;
      if (type === 'toll') modifier = -board.tollValue;
      if (type === 'bonus') modifier = board.bonusValue;

      jobs.push({
        currentId: nId,
        visited: new Set([...job.visited, nId]),
        path: [...job.path, nId],
        total: job.total + neighborValue + modifier,
      });
    }
  }

  return results.sort((a, b) => b.total - a.total);
}
