/**
 * API smoke checks.
 *
 * Exercises the live HTTP API against the current request/response contract
 * (shared/validators/game.ts + server/db/validators.ts) rather than
 * hand-rolled shape assumptions. Response bodies are parsed with the same
 * Zod schemas the server and client rely on, so a drifted contract fails
 * loudly here instead of silently in production.
 *
 * Usage:
 * 1) Start app:  pnpm dev
 * 2) Seed DB:    pnpm db:seed:local
 * 3) Run checks: pnpm test:api
 *
 * The local dev seed (scripts/generate-dev-seed.ts) only creates 3 game
 * days (gameNo 1-3), well under the deep-archive threshold of
 * RECENT_ARCHIVE_DAY_LIMIT + 1 (31). That means /api/games/another will
 * always report 404 "no deep-archive road available yet" against the local
 * seed - this script treats that as an expected, intentionally reported
 * branch rather than a failure (see checkAnotherGame below). If you seed a
 * larger dataset (31+ game days), the 200 branch will exercise instead.
 */

import {
  CurrentGamesResponseSchema,
  HintResultSchema,
  StatsOverviewSchema,
} from '../shared/validators/game';
import { RECENT_ARCHIVE_DAY_LIMIT } from '../shared/utils/archive';
import { z } from 'zod';

const baseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

function logOk(message: string) {
  console.log(`  ok - ${message}`);
}

async function request(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(`${baseURL}${path}`, options);
  const text = await res.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: res.status, body, text };
}

function expectStatus(
  context: string,
  actual: number,
  expected: number,
  text: string,
) {
  if (actual !== expected) {
    throw new Error(
      `${context}: expected status ${expected}, got ${actual}. Response: ${text}`,
    );
  }
}

function parseOrThrow<T>(
  context: string,
  schema: z.ZodType<T>,
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `${context}: response did not match expected schema.\n${result.error.message}\nReceived: ${JSON.stringify(data)}`,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

async function checkCurrentGames() {
  const { status, body, text } = await request('/api/games/current');
  expectStatus('GET /api/games/current', status, 200, text);
  const current = parseOrThrow(
    'GET /api/games/current',
    CurrentGamesResponseSchema,
    body,
  );

  if (!current.classic && !current.expedition) {
    throw new Error(
      'GET /api/games/current: expected at least one of classic/expedition to be non-null',
    );
  }

  logOk('returns a schema-valid current games payload');
  return current;
}

async function checkPastGames() {
  const { status, body, text } = await request('/api/games/past?limit=5');
  expectStatus('GET /api/games/past', status, 200, text);

  // NOTE: shared/validators/game.ts still exports a flat PastGameSummarySchema
  // ({ gameNo, maxScore, totalCoins, playableAt }) left over from before the
  // P0-4 dual-puzzle archive rework. The actual route now returns
  // { count, games: [{ gameNo, playableAt, classic, expedition }] } grouped
  // per road day. That schema is stale and does not match this endpoint, so
  // this check validates the real shape directly instead of importing it.
  // Flagged for cleanup - see report.
  const PastGamesResponseSchema = z.object({
    count: z.number().int().min(0),
    games: z.array(
      z.object({
        gameNo: z.number().int().positive(),
        playableAt: z.string(),
        classic: z
          .object({
            maxScore: z.number().int().min(1),
            totalCoins: z.number().int().min(1),
            difficultyBand: z.enum(['easy', 'medium', 'hard']),
          })
          .nullable(),
        expedition: z
          .object({
            maxScore: z.number().int().min(1),
            totalCoins: z.number().int().min(1),
            difficultyBand: z.enum(['easy', 'medium', 'hard']),
          })
          .nullable(),
      }),
    ),
  });

  parseOrThrow('GET /api/games/past', PastGamesResponseSchema, body);
  logOk('returns a schema-valid grouped past-games payload');
}

async function checkGameBoard(gameNo: number) {
  const { status, body, text } = await request(`/api/games/${gameNo}/board`);
  expectStatus(`GET /api/games/${gameNo}/board`, status, 200, text);
  parseOrThrow(
    `GET /api/games/${gameNo}/board`,
    CurrentGamesResponseSchema,
    body,
  );
  logOk(`returns a schema-valid board payload for game ${gameNo}`);
}

async function checkAnotherGame(playerId: string) {
  const { status, body, text } = await request(
    `/api/games/another?playerId=${playerId}`,
  );

  if (status === 200) {
    parseOrThrow(
      'GET /api/games/another',
      z.object({ gameNo: z.number().int().positive() }),
      body,
    );
    logOk('returns a random deep-archive gameNo (200 branch)');
    return;
  }

  if (status === 404) {
    // Intentional, clearly-reported branch: the local dev seed only has 3
    // game days, below the deep-archive threshold
    // (RECENT_ARCHIVE_DAY_LIMIT + 1 = ${RECENT_ARCHIVE_DAY_LIMIT + 1}), so
    // there is no deep-archive pool to draw from yet.
    logOk(
      `returns 404 as expected - seed data has fewer than ${RECENT_ARCHIVE_DAY_LIMIT + 1} game days, so no deep-archive road exists yet`,
    );
    return;
  }

  throw new Error(
    `GET /api/games/another: expected 200 or 404, got ${status}. Response: ${text}`,
  );
}

async function checkHint(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  startTile: number,
) {
  const playerUUID = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const { status, body, text } = await request('/api/session/hint', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID,
      gameNo,
      puzzleType,
      sessionId,
      attemptNumber: 1,
      pathHistory: [startTile],
    }),
  });

  expectStatus('POST /api/session/hint', status, 200, text);
  const parsed = parseOrThrow(
    'POST /api/session/hint',
    z.object({ ok: z.literal(true), hint: HintResultSchema }),
    body,
  );

  if (parsed.hint.kind !== 'next-step' && parsed.hint.kind !== 'diverged') {
    throw new Error(
      `POST /api/session/hint: unexpected hint kind ${(parsed.hint as { kind: string }).kind}`,
    );
  }

  logOk(`returns a schema-valid ${parsed.hint.kind} hint from the start tile`);
}

async function checkSessionEndUnsolved(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  score: number,
) {
  const playerUUID = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const { status, body, text } = await request('/api/session/end', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID,
      gameNo,
      puzzleType,
      sessionId,
      score,
      moves: 1,
      attemptNumber: 1,
      solved: false,
      endReason: 'retry',
      hintsUsed: 1,
    }),
  });

  expectStatus('POST /api/session/end (unsolved)', status, 200, text);
  const parsed = parseOrThrow(
    'POST /api/session/end (unsolved)',
    z.object({
      ok: z.literal(true),
      gameNo: z.number().int().positive(),
      medal: z.enum(['gold', 'silver', 'bronze']).nullable(),
      score: z.number().int().min(0),
      solved: z.literal(false),
    }),
    body,
  );

  if (parsed.medal !== null) {
    throw new Error(
      `POST /api/session/end (unsolved): expected medal to be null for an unsolved run, got ${parsed.medal}`,
    );
  }

  logOk('records an unsolved run with no medal');
}

async function checkSessionEndSolvedFirstAttempt(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  maxScore: number,
) {
  const playerUUID = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const { status, body, text } = await request('/api/session/end', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID,
      gameNo,
      puzzleType,
      sessionId,
      score: maxScore,
      moves: 4,
      attemptNumber: 1,
      solved: true,
      endReason: 'solved',
      hintsUsed: 0,
      solveTimeMs: 12345,
    }),
  });

  expectStatus('POST /api/session/end (solved)', status, 200, text);
  const parsed = parseOrThrow(
    'POST /api/session/end (solved)',
    z.object({
      ok: z.literal(true),
      gameNo: z.number().int().positive(),
      medal: z.enum(['gold', 'silver', 'bronze']).nullable(),
      score: z.number().int().min(0),
      solved: z.literal(true),
    }),
    body,
  );

  if (parsed.medal !== 'gold') {
    throw new Error(
      `POST /api/session/end (solved): expected gold medal on attempt 1, got ${parsed.medal}`,
    );
  }

  logOk('awards gold medal for a first-attempt solve');
}

async function checkSessionEndRejectsInconsistentEndReason(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
) {
  const { status, text } = await request('/api/session/end', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID: crypto.randomUUID(),
      gameNo,
      puzzleType,
      sessionId: crypto.randomUUID(),
      score: 1,
      moves: 1,
      attemptNumber: 1,
      solved: true,
      endReason: 'retry', // invalid: solved runs must use endReason 'solved'
      hintsUsed: 0,
    }),
  });

  expectStatus(
    'POST /api/session/end (solved=true, endReason=retry)',
    status,
    400,
    text,
  );
  logOk('rejects solved:true paired with a non-"solved" endReason (400)');
}

async function checkStatsOverview() {
  const { status, body, text } = await request('/api/stats/overview');
  expectStatus('GET /api/stats/overview', status, 200, text);
  parseOrThrow('GET /api/stats/overview', StatsOverviewSchema, body);
  logOk('returns a schema-valid stats overview with currentGameNo + yesterday block');
}

async function checkErrorBranches() {
  {
    const { status, text } = await request('/api/games/999999/board');
    expectStatus('GET /api/games/999999/board', status, 404, text);
    logOk('returns 404 for a nonexistent gameNo');
  }
  {
    const { status, text } = await request('/api/games/not-a-number/board');
    expectStatus('GET /api/games/not-a-number/board', status, 400, text);
    logOk('returns 400 for a non-numeric gameNo param');
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  console.log(`Running API smoke checks against ${baseURL}\n`);

  console.log('games/current');
  const current = await checkCurrentGames();
  const currentGame = current.classic ?? current.expedition;
  if (!currentGame) {
    throw new Error('No current game available to drive the remaining checks');
  }

  console.log('\ngames/past');
  await checkPastGames();

  console.log('\ngames/[gameNo]/board');
  await checkGameBoard(currentGame.gameNo);

  console.log('\ngames/another (random deep-archive road)');
  await checkAnotherGame(crypto.randomUUID());

  console.log('\nsession/hint');
  await checkHint(
    currentGame.gameNo,
    currentGame.puzzleType,
    currentGame.board.start,
  );

  console.log('\nsession/end');
  await checkSessionEndUnsolved(
    currentGame.gameNo,
    currentGame.puzzleType,
    currentGame.board.tiles[currentGame.board.start] ?? 0,
  );
  await checkSessionEndSolvedFirstAttempt(
    currentGame.gameNo,
    currentGame.puzzleType,
    currentGame.maxScore,
  );
  await checkSessionEndRejectsInconsistentEndReason(
    currentGame.gameNo,
    currentGame.puzzleType,
  );

  console.log('\nstats/overview');
  await checkStatsOverview();

  console.log('\nerror branches');
  await checkErrorBranches();

  console.log('\nAll API checks passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
