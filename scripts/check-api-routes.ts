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

const AggregateCountersSchema = z.object({
  playsCount: z.number().int().min(0),
  finishedCount: z.number().int().min(0),
  goldCount: z.number().int().min(0),
  silverCount: z.number().int().min(0),
  bronzeCount: z.number().int().min(0),
});

type AggregateCounters = z.infer<typeof AggregateCountersSchema>;
type AggregateCounterName = keyof AggregateCounters;

/**
 * Aggregate counters are deliberately not part of any public API response
 * (today's road never exposes community aggregation), so idempotency checks
 * read them straight from the local D1 database the dev server writes to.
 */
async function getCurrentGameAggregates(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
): Promise<AggregateCounters> {
  const query =
    'SELECT plays_count AS playsCount, finished_count AS finishedCount, ' +
    'gold_count AS goldCount, silver_count AS silverCount, bronze_count AS bronzeCount ' +
    `FROM games WHERE game_no = ${gameNo} AND puzzle_type = '${puzzleType}' LIMIT 1`;
  const { execFileSync } = await import('node:child_process');
  const stdout = execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.jsonc',
      '--json',
      '--command',
      query,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        XDG_CONFIG_HOME: '.wrangler/xdg-config',
        XDG_CACHE_HOME: '.wrangler/xdg-cache',
      },
    },
  );
  const parsed = z
    .array(z.object({ results: z.array(AggregateCountersSchema) }))
    .parse(JSON.parse(stdout));
  const counters = parsed[0]?.results[0];
  if (!counters) {
    throw new Error(
      `local D1 aggregate counters: no games row for ${puzzleType} game ${gameNo}`,
    );
  }
  return counters;
}

function expectAggregateDeltas(
  context: string,
  before: AggregateCounters,
  after: AggregateCounters,
  expected: Partial<Record<AggregateCounterName, number>>,
) {
  const counterNames: AggregateCounterName[] = [
    'playsCount',
    'finishedCount',
    'goldCount',
    'silverCount',
    'bronzeCount',
  ];
  for (const counter of counterNames) {
    const expectedValue = before[counter] + (expected[counter] ?? 0);
    if (after[counter] !== expectedValue) {
      throw new Error(
        `${context}: expected ${counter} ${before[counter]} -> ${expectedValue}, got ${after[counter]}`,
      );
    }
  }
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

  const parsed = parseOrThrow(
    'GET /api/games/past',
    PastGamesResponseSchema,
    body,
  );
  const archivedGame = parsed.games[0];
  if (!archivedGame) {
    throw new Error(
      'GET /api/games/past: expected at least one archived road for the board smoke check',
    );
  }
  logOk('returns a schema-valid grouped past-games payload');
  return archivedGame.gameNo;
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

async function checkAnotherGame() {
  const { status, body, text } = await request('/api/games/another');

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

async function checkSessionStart(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
) {
  const before = await getCurrentGameAggregates(gameNo, puzzleType);
  const playerUUID = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const payload = { playerUUID, gameNo, puzzleType, sessionId };

  for (const label of ['initial', 'duplicate']) {
    const { status, body, text } = await request('/api/session/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expectStatus(`POST /api/session/start (${label})`, status, 200, text);
    parseOrThrow(
      `POST /api/session/start (${label})`,
      z.object({ ok: z.literal(true), gameNo: z.number().int().positive() }),
      body,
    );
  }

  const after = await getCurrentGameAggregates(gameNo, puzzleType);
  expectAggregateDeltas(
    'POST /api/session/start duplicate aggregates',
    before,
    after,
    { playsCount: 1 },
  );

  logOk(
    'accepts a unique start and its idempotent duplicate, incrementing plays once',
  );
}

async function checkSessionEndRejectsNonSolveContract(
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
      solved: false,
      endReason: 'retry',
      hintsUsed: 0,
    }),
  });

  expectStatus(
    'POST /api/session/end (obsolete non-solve payload)',
    status,
    400,
    text,
  );
  logOk('rejects the obsolete non-solve session-end contract');
}

async function checkSessionEndSolvedFirstAttempt(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  maxScore: number,
) {
  const before = await getCurrentGameAggregates(gameNo, puzzleType);
  const playerUUID = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const payload = {
    playerUUID,
    gameNo,
    puzzleType,
    sessionId,
    score: maxScore,
    moves: 4,
    attemptNumber: 1,
    hintsUsed: 0,
    solveTimeMs: 12345,
  };

  for (const label of ['initial', 'sequential duplicate']) {
    const { status, body, text } = await request('/api/session/end', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expectStatus(`POST /api/session/end (${label})`, status, 200, text);
    const parsed = parseOrThrow(
      `POST /api/session/end (${label})`,
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
        `POST /api/session/end (${label}): expected gold medal on attempt 1, got ${parsed.medal}`,
      );
    }
  }
  const after = await getCurrentGameAggregates(gameNo, puzzleType);
  expectAggregateDeltas(
    'POST /api/session/end duplicate aggregates',
    before,
    after,
    {
      playsCount: 1,
      finishedCount: 1,
      goldCount: 1,
    },
  );

  logOk(
    'accepts an exact solve and its idempotent sequential duplicate, incrementing play/finish/gold once',
  );
}

async function checkSessionEndRejectsNonExactScore(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  maxScore: number,
) {
  for (const score of [maxScore - 1, maxScore + 1]) {
    const { status, text } = await request('/api/session/end', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerUUID: crypto.randomUUID(),
        gameNo,
        puzzleType,
        sessionId: crypto.randomUUID(),
        score,
        moves: 4,
        attemptNumber: 1,
        hintsUsed: 0,
        solveTimeMs: 12345,
      }),
    });
    expectStatus(`POST /api/session/end (non-exact score ${score})`, status, 400, text);
  }
  logOk('rejects scores both below and above the exact target');
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
  const archivedGameNo = await checkPastGames();

  console.log('\ngames/[gameNo]/board');
  await checkGameBoard(archivedGameNo);

  console.log('\ngames/another (random deep-archive road)');
  await checkAnotherGame();

  console.log('\nsession/hint');
  await checkHint(
    currentGame.gameNo,
    currentGame.puzzleType,
    currentGame.board.start,
  );

  console.log('\nsession/end');
  await checkSessionStart(currentGame.gameNo, currentGame.puzzleType);
  await checkSessionEndRejectsNonSolveContract(
    currentGame.gameNo,
    currentGame.puzzleType,
  );
  await checkSessionEndSolvedFirstAttempt(
    currentGame.gameNo,
    currentGame.puzzleType,
    currentGame.maxScore,
  );
  await checkSessionEndRejectsNonExactScore(
    currentGame.gameNo,
    currentGame.puzzleType,
    currentGame.maxScore,
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
