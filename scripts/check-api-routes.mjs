/*
 * Lightweight API integration checks.
 *
 * Usage:
 * 1) Start app: pnpm dev
 * 2) Seed DB: pnpm db:seed:local
 * 3) Run checks: pnpm test:api
 */

const baseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

async function expectStatus(path, expectedStatus, options = {}) {
  const res = await fetch(`${baseURL}${path}`, options);
  if (res.status !== expectedStatus) {
    const text = await res.text();
    throw new Error(
      `Expected ${expectedStatus} for ${path}, got ${res.status}. Response: ${text}`,
    );
  }
  return res;
}

async function run() {
  const playerId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const currentRes = await expectStatus('/api/games/current', 200);
  const current = await currentRes.json();
  const currentGame = current.classic ?? current.expedition;
  if (!currentGame) {
    throw new Error(
      'Expected at least one current game from /api/games/current',
    );
  }

  // Happy path checks
  await expectStatus(`/api/games/another?playerId=${playerId}`, 200);
  await expectStatus('/api/games/past?limit=5', 200);
  await expectStatus(`/api/games/${currentGame.gameNo}/board`, 200);

  await expectStatus('/api/session/hint', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID: playerId,
      gameNo: currentGame.gameNo,
      puzzleType: currentGame.puzzleType,
      sessionId,
      attemptNumber: 1,
      pathHistory: [currentGame.board.start],
    }),
  });

  await expectStatus('/api/session/end', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID: playerId,
      gameNo: currentGame.gameNo,
      puzzleType: currentGame.puzzleType,
      sessionId,
      score: currentGame.board.tiles[currentGame.board.start] ?? 0,
      moves: 1,
      attemptNumber: 1,
      solved: false,
      endReason: 'retry',
      hintsUsed: 1,
    }),
  });

  const statsRes = await expectStatus('/api/stats/overview', 200);
  const stats = await statsRes.json();
  if (!stats.current || !stats.yesterday) {
    throw new Error(
      'Expected current and yesterday blocks from /api/stats/overview',
    );
  }

  // Error path checks (404 / 400)
  await expectStatus('/api/games/999999/board', 404);
  await expectStatus('/api/games/not-a-number/board', 400);

  console.log('All API checks passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
