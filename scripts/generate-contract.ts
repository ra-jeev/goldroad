import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import * as constants from '../lib/gameConstants';
import { calcMedalForAttempt } from '../lib/gameTiers';
import { UI_COPY } from '../app/content/uiCopy';
import { buildEdgeMap, getActiveNeighbors, getMoveScore, getRunOutcome } from '../shared/utils/puzzleEngine';
import { computeHint, hintRevealsNewTile } from '../shared/utils/hints';
import { applyUndoLastStep, canUndoLastStep, isUndoTapTarget, nextUndoAvailable } from '../app/utils/undoLastStep';
import { getHintMessage } from '../app/utils/hintMessage';
import { buildRoadResultShareText, buildDayResultShareText } from '../app/utils/pure/roadResultShare';
import { buildModeSummary, type StatsModeEntry } from '../app/utils/pure/playerStats';
import { topPercent } from '../app/utils/statsPresentation';
import { roadAvailability } from '../app/utils/pure/roadAvailability';
import { buildAPIContract } from './contract-api';
import type { Board, CommunityRoadStats, HintResult, PublicGame } from '../shared/types/game';

// The two 6x6 roads and their optimal paths are snapshots from dev_seed.sql.
// They are inputs. The expected results below are computed from the web code.
const inputs = {
  "tiny": {
    "gameNo": 1,
    "puzzleType": "classic",
    "maxScore": 17,
    "totalCoins": 20,
    "playableAt": "2026-01-01T00:00:00Z",
    "nextGameAt": null,
    "board": {
      "rows": 3,
      "cols": 3,
      "tiles": [
        2,
        3,
        1,
        1,
        4,
        2,
        1,
        1,
        5
      ],
      "missingEdges": [
        {
          "from": 0,
          "to": 3
        },
        {
          "from": 2,
          "to": 5
        }
      ],
      "tollEdges": [
        {
          "from": 0,
          "to": 1
        }
      ],
      "bonusEdges": [
        {
          "from": 1,
          "to": 4
        }
      ],
      "tollValue": 2,
      "bonusValue": 3,
      "start": 0,
      "end": 8
    }
  },
  "classic": {
    "gameNo": 1,
    "puzzleType": "classic",
    "maxScore": 92,
    "totalCoins": 122,
    "playableAt": "2026-01-01T00:00:00.000Z",
    "nextGameAt": null,
    "board": {
      "rows": 6,
      "cols": 6,
      "tiles": [
        5,
        6,
        6,
        6,
        6,
        3,
        2,
        2,
        1,
        6,
        6,
        1,
        2,
        4,
        3,
        3,
        2,
        2,
        2,
        6,
        1,
        3,
        1,
        6,
        1,
        3,
        4,
        3,
        2,
        3,
        6,
        4,
        4,
        3,
        1,
        3
      ],
      "missingEdges": [
        {
          "from": 5,
          "to": 11
        },
        {
          "from": 3,
          "to": 9
        },
        {
          "from": 4,
          "to": 10
        },
        {
          "from": 12,
          "to": 18
        },
        {
          "from": 28,
          "to": 34
        },
        {
          "from": 17,
          "to": 23
        },
        {
          "from": 13,
          "to": 14
        },
        {
          "from": 18,
          "to": 24
        },
        {
          "from": 8,
          "to": 14
        },
        {
          "from": 29,
          "to": 35
        },
        {
          "from": 10,
          "to": 11
        }
      ],
      "tollEdges": [],
      "bonusEdges": [],
      "tollValue": 2,
      "bonusValue": 5,
      "start": 20,
      "end": 0
    },
    "optimalPaths": [
      [
        20,
        14,
        15,
        9,
        10,
        16,
        22,
        23,
        29,
        28,
        27,
        26,
        32,
        31,
        30,
        24,
        25,
        19,
        13,
        12,
        6,
        7,
        8,
        2,
        1,
        0
      ],
      [
        20,
        19,
        25,
        24,
        30,
        31,
        32,
        26,
        27,
        28,
        29,
        23,
        22,
        21,
        15,
        16,
        10,
        9,
        8,
        2,
        1,
        7,
        13,
        12,
        6,
        0
      ],
      [
        20,
        21,
        15,
        9,
        10,
        16,
        22,
        23,
        29,
        28,
        27,
        26,
        32,
        31,
        30,
        24,
        25,
        19,
        13,
        12,
        6,
        7,
        8,
        2,
        1,
        0
      ]
    ]
  },
  "expedition": {
    "gameNo": 1,
    "puzzleType": "expedition",
    "maxScore": 126,
    "totalCoins": 135,
    "playableAt": "2026-01-01T00:00:00.000Z",
    "nextGameAt": null,
    "board": {
      "rows": 6,
      "cols": 6,
      "tiles": [
        3,
        6,
        2,
        4,
        4,
        4,
        3,
        3,
        6,
        5,
        5,
        3,
        1,
        6,
        2,
        2,
        5,
        5,
        2,
        6,
        2,
        4,
        4,
        6,
        2,
        5,
        4,
        4,
        5,
        4,
        1,
        2,
        3,
        3,
        6,
        3
      ],
      "missingEdges": [
        {
          "from": 12,
          "to": 18
        },
        {
          "from": 19,
          "to": 20
        },
        {
          "from": 5,
          "to": 11
        },
        {
          "from": 20,
          "to": 26
        },
        {
          "from": 10,
          "to": 11
        },
        {
          "from": 26,
          "to": 27
        },
        {
          "from": 8,
          "to": 9
        },
        {
          "from": 21,
          "to": 27
        },
        {
          "from": 13,
          "to": 14
        },
        {
          "from": 16,
          "to": 22
        }
      ],
      "tollEdges": [
        {
          "from": 17,
          "to": 23
        },
        {
          "from": 2,
          "to": 3
        }
      ],
      "bonusEdges": [
        {
          "from": 22,
          "to": 23
        }
      ],
      "tollValue": 1,
      "bonusValue": 4,
      "start": 26,
      "end": 4
    },
    "optimalPaths": [
      [
        26,
        25,
        19,
        18,
        24,
        30,
        31,
        32,
        33,
        27,
        28,
        34,
        35,
        29,
        23,
        22,
        21,
        20,
        14,
        8,
        7,
        13,
        12,
        6,
        0,
        1,
        2,
        3,
        9,
        15,
        16,
        10,
        4
      ],
      [
        26,
        25,
        19,
        18,
        24,
        30,
        31,
        32,
        33,
        34,
        35,
        29,
        28,
        22,
        23,
        17,
        16,
        10,
        9,
        15,
        21,
        20,
        14,
        8,
        7,
        13,
        12,
        6,
        0,
        1,
        2,
        3,
        4
      ],
      [
        26,
        25,
        19,
        18,
        24,
        30,
        31,
        32,
        33,
        34,
        35,
        29,
        28,
        22,
        23,
        17,
        16,
        15,
        21,
        20,
        14,
        8,
        7,
        13,
        12,
        6,
        0,
        1,
        2,
        3,
        9,
        10,
        4
      ]
    ]
  }
} as const;

type Road = Omit<PublicGame, 'puzzleType'> & { puzzleType: 'classic' | 'expedition' };
const tiny = inputs.tiny as unknown as Road;
const classic = inputs.classic as unknown as Road & { optimalPaths: number[][] };
const expedition = inputs.expedition as unknown as Road & { optimalPaths: number[][] };

function runRoad(road: Road, taps: number[]) {
  const board = road.board;
  const edgeMap = buildEdgeMap(board);
  let path = [board.start];
  let score = board.tiles[board.start]!;
  let undoAvailable = false;
  let outcome: ReturnType<typeof getRunOutcome> = 'inProgress';
  for (const tile of taps) {
    if (outcome !== 'inProgress') break;
    const current = path.at(-1)!;
    const moves = getActiveNeighbors(current, board.rows, board.cols, edgeMap, new Set(path));
    if (!moves.includes(tile)) {
      if (isUndoTapTarget(path, tile) && canUndoLastStep({ ended: false, undoAvailable })) {
        const restored = applyUndoLastStep(board, { pathHistory: path, score, moves: path.length });
        if (restored) {
          path = restored.pathHistory;
          score = restored.score;
          undoAvailable = nextUndoAvailable('undo', false);
        }
      }
      continue;
    }
    score += getMoveScore(board, edgeMap, current, tile);
    path.push(tile);
    const neighbors = getActiveNeighbors(tile, board.rows, board.cols, edgeMap, new Set(path));
    outcome = getRunOutcome(board, tile, score, road.maxScore, neighbors);
    undoAvailable = nextUndoAvailable('move', outcome !== 'inProgress');
  }
  const legalMoves = outcome === 'inProgress'
    ? getActiveNeighbors(path.at(-1)!, board.rows, board.cols, edgeMap, new Set(path)).sort((a, b) => a - b)
    : [];
  return { path, score, legalMoves, canUndo: canUndoLastStep({ ended: outcome !== 'inProgress', undoAvailable }), outcome };
}

const cases: Array<{ name: string; taps: number[]; road?: Road; hintBeforeTap?: number; hintOptimalPaths?: number[][] }> = [
  { name: 'Missing road', taps: [3] },
  { name: 'Toll', taps: [1] },
  { name: 'Bonus', taps: [1, 4] },
  { name: 'Undo once', taps: [1, 4, 1, 0] },
  { name: 'Undo after hint', taps: [1, 4, 1], hintBeforeTap: 2, hintOptimalPaths: [[0, 1, 4, 5, 8]] },
  { name: 'Exact target', taps: [1, 4, 5, 8] },
  { name: 'Under target', taps: [1, 4, 7, 8] },
  { name: 'Over target', taps: [1, 4, 5, 8], road: { ...tiny, maxScore: 16 } },
  { name: 'Dead end', taps: [1, 2, 1] },
  { name: 'Classic 6x6 exact', taps: classic.optimalPaths[0]!.slice(1), road: classic },
  { name: 'Expedition 6x6 exact', taps: expedition.optimalPaths[0]!.slice(1), road: expedition },
];

const hintCases = [
  { name: 'First step', optimalPaths: classic.optimalPaths, pathHistory: classic.optimalPaths[0]!.slice(0, 1), revealedGuide: [] },
  { name: 'Reveal another', optimalPaths: classic.optimalPaths, pathHistory: classic.optimalPaths[0]!.slice(0, 1), revealedGuide: classic.optimalPaths[0]!.slice(0, 2) },
  { name: 'Diverged', optimalPaths: [[0, 1, 4, 5, 8]], pathHistory: [0, 1, 2], revealedGuide: [] },
  { name: 'Already solved', optimalPaths: [[0, 1, 4, 5, 8]], pathHistory: [0, 1, 4, 5, 8], revealedGuide: [] },
];
const hintSequence = { optimalPaths: classic.optimalPaths, pathHistory: classic.optimalPaths[0]!.slice(0, 1), requests: 6 };
let guide: number[] = [];
let hintsUsed = 0;
const hintSteps = Array.from({ length: hintSequence.requests }, () => {
  if (hintsUsed >= constants.HINTS_PER_ROAD_MODE) return { hintsUsed, guidePath: guide, result: null };
  const result = computeHint(hintSequence.optimalPaths, hintSequence.pathHistory, guide);
  if (hintRevealsNewTile(guide, result.guidePath)) { guide = result.guidePath; hintsUsed++; }
  return { hintsUsed, guidePath: guide, result };
});
const hintKinds: HintResult['kind'][] = ['next-step', 'diverged', 'already-solved'];
const shares = [
  { gameNo: 12, puzzleType: 'classic' as const, attempts: 1, solved: true, solveTimeMs: null, hintsUsed: 0 },
  { gameNo: 12, puzzleType: 'expedition' as const, attempts: 3, solved: true, solveTimeMs: 90500, hintsUsed: 2 },
  { gameNo: 12, puzzleType: 'classic' as const, attempts: 11, solved: false, solveTimeMs: null, hintsUsed: 0 },
];
const dayShares = [{ gameNo: 12, classic: { attempts: 1, solved: true, solveTimeMs: 10000 }, expedition: { attempts: 2, solved: true, solveTimeMs: 20000 } },
  { gameNo: 12, classic: { attempts: 4, solved: true, solveTimeMs: null }, expedition: null }];
const history: StatsModeEntry[] = [
  { day: '2026-01-01', gameNo: 1, puzzleType: 'classic', attempts: 1, solved: true, hintsUsed: 0, solveTimeMs: 60000, updatedAt: '2026-01-01T12:00:00Z' },
  { day: '2026-01-02', gameNo: 2, puzzleType: 'classic', attempts: 2, solved: true, hintsUsed: 1, solveTimeMs: 90000, updatedAt: '2026-01-02T12:00:00Z' },
  { day: '2026-01-04', gameNo: 4, puzzleType: 'classic', attempts: 3, solved: true, hintsUsed: 2, solveTimeMs: null, updatedAt: '2026-01-04T12:00:00Z' },
  { day: '2026-01-05', gameNo: 5, puzzleType: 'classic', attempts: 4, solved: false, hintsUsed: 0, solveTimeMs: null, updatedAt: '2026-01-05T12:00:00Z' },
  { day: '2026-01-04', gameNo: 4, puzzleType: 'expedition', attempts: 4, solved: true, hintsUsed: 1, solveTimeMs: 120000, updatedAt: '2026-01-04T12:00:00Z' },
];
const field = { plays: 30, solvedAttemptsExact: Object.fromEntries(Array.from({length: 29}, (_, i) => [String(i + 1), 1]).concat([['40', 1]])) } as CommunityRoadStats;
const now = '2026-01-02T00:00:00.000Z';
const rolloverCases = [
  { current: null, fetched: null },
  { current: null, fetched: { gameNo: 1, nextGameAt: '2026-01-03T00:00:00Z' } },
  { current: null, fetched: { gameNo: 1, nextGameAt: now } },
  { current: { gameNo: 1 }, fetched: { gameNo: 1, nextGameAt: now } },
  { current: { gameNo: 1 }, fetched: { gameNo: 2, nextGameAt: '2026-01-03T00:00:00Z' } },
  { current: { gameNo: 2 }, fetched: { gameNo: 1, nextGameAt: '2026-01-03T00:00:00Z' } },
];

const files = new Map<string, unknown>([
  ['constants.json', {
    ...Object.fromEntries(Object.keys(constants).sort().map(key => [key, constants[key as keyof typeof constants]])),
    feedbackMailto: UI_COPY.contact.feedbackMailto,
  }],
  ['fixtures/rules.json', { road: tiny, cases: cases.map(input => ({ ...input, ...(input.hintBeforeTap !== undefined && input.hintOptimalPaths
    ? { hintResult: computeHint(input.hintOptimalPaths, runRoad(input.road ?? tiny, input.taps.slice(0, input.hintBeforeTap)).path) }
    : {}), ...runRoad(input.road ?? tiny, input.taps) })) }],
  ['fixtures/hints.json', { cases: hintCases.map(input => ({ ...input, expected: computeHint(input.optimalPaths, input.pathHistory, input.revealedGuide) })), sequence: { ...hintSequence, steps: hintSteps } }],
  ['fixtures/hint-messages.json', { cases: hintKinds.flatMap(kind => [0, 1, 2].map(highlightedCount => ({ kind, highlightedCount, message: getHintMessage(kind, highlightedCount) }))) }],
  ['fixtures/medals.json', { cases: [1, 2, 3, 4, 10].flatMap(attempts => [true, false].map(solved => ({ attempts, solved, medal: calcMedalForAttempt(attempts, solved) }))) }],
  ['fixtures/share.json', { single: shares.map(input => ({ input, expected: buildRoadResultShareText(input) })), day: dayShares.map(input => ({ input, expected: buildDayResultShareText(input) })) }],
  ['fixtures/stats.json', { history, currentGameNo: 5, todayKey: '2026-01-05', classic: buildModeSummary(history, 'classic', 5, '2026-01-05'), expedition: buildModeSummary(history, 'expedition', 5, '2026-01-05'), percentile: [1, 25, 30, 40].map(attempts => ({ field, attempts, expected: topPercent(field, attempts) })) }],
  ['fixtures/rollover.json', { cases: rolloverCases.map(input => ({ ...input, now, expected: roadAvailability(input.current, input.fetched, Date.parse(now)) })) }],
]);

export const apiContracts = buildAPIContract(classic, expedition, computeHint(classic.optimalPaths, [classic.board.start]));
for (const [name, contract] of Object.entries(apiContracts)) {
  const parsed = contract.schema.safeParse(contract.sample);
  if (!parsed.success) throw new Error(`Invalid API sample ${name}: ${parsed.error.message}`);
  files.set(`api/${name}.schema.json`, z.toJSONSchema(contract.schema, { io: contract.io ?? 'output' }));
  files.set(`api/samples/${name}.json`, contract.sample);
}

function writeFiles(root: string) {
  for (const [path, data] of files) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
  }
}

function managedFiles(root: string): string[] {
  function list(path: string): string[] {
    return readdirSync(join(root, path), { withFileTypes: true }).flatMap(entry => {
      const child = join(path, entry.name);
      return entry.isDirectory() ? list(child) : [child];
    });
  }
  return ['constants.json', ...list('fixtures'), ...list('api')].sort();
}

export function checkContract(target: string) {
  const temp = mkdtempSync(join(tmpdir(), 'goldroad-contract-'));
  try {
    writeFiles(temp);
    const actual = managedFiles(target);
    const expected = managedFiles(temp);
    const mismatches = [...new Set([...actual, ...expected])].filter(path =>
      !actual.includes(path) || !expected.includes(path) || readFileSync(join(target, path), 'utf8') !== readFileSync(join(temp, path), 'utf8'));
    if (mismatches.length) throw new Error(`Contract differs: ${mismatches.join(', ')}. Run pnpm contract:generate.`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const target = resolve('contract');
  if (process.argv.includes('--check')) {
    checkContract(target);
    console.log('Contract matches generated output.');
  } else {
    writeFiles(target);
    console.log(`Generated ${files.size} contract files.`);
  }
}
