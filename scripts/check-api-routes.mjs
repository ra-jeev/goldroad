/*
 * Lightweight API integration checks.
 *
 * Usage:
 * 1) Start app: pnpm dev
 * 2) Seed DB: pnpm db:seed:local
 * 3) Run checks: pnpm test:api
 */

const baseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3000'

async function expectStatus(path, expectedStatus, options = {}) {
  const res = await fetch(`${baseURL}${path}`, options)
  if (res.status !== expectedStatus) {
    const text = await res.text()
    throw new Error(`Expected ${expectedStatus} for ${path}, got ${res.status}. Response: ${text}`)
  }
  return res
}

async function run() {
  const playerId = '2f1d2b2d-9b86-468b-b8f3-4ca4f451d001'
  const sessionId = '2f1d2b2d-9b86-468b-b8f3-4ca4f451d002'

  // Happy path checks
  await expectStatus('/api/games/current', 200)
  await expectStatus(`/api/games/another?playerId=${playerId}`, 200)
  await expectStatus('/api/games/past?limit=5', 200)
  await expectStatus('/api/games/3/board', 200)

  await expectStatus('/api/session/hint', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID: playerId,
      gameNo: 3,
      sessionId,
      level: 1,
      currentTileIndex: 12,
    }),
  })

  await expectStatus('/api/session/end', 200, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      playerUUID: playerId,
      gameNo: 3,
      sessionId,
      score: 39,
      moves: 9,
      attempts: 1,
      tier: 'gold',
      hintsLevel1: 1,
      hintsLevel2: 0,
      hintsLevel3: 0,
    }),
  })

  // Error path checks (404 / 400)
  await expectStatus('/api/games/999999/board', 404)
  await expectStatus('/api/games/not-a-number/board', 400)

  console.log('All API checks passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
