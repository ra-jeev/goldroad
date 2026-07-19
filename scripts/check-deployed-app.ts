import {
  CurrentGamesResponseSchema,
  HintResultSchema,
} from '../shared/validators/game';
import { z } from 'zod';

const baseUrl = new URL(process.argv[2] ?? 'https://v2.playgoldroad.com');
const shouldWriteAnalytics = process.argv.includes('--write-analytics');
const testPlayerUUID = '00000000-0000-4000-8000-000000000019';
const testSessionId = '00000000-0000-4000-8000-000000000020';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function get(path: string, init?: RequestInit) {
  const response = await fetch(new URL(path, baseUrl), init);
  console.log(`${response.status} ${path}`);
  return response;
}

async function main() {
  const home = await get('/');
  assert(home.ok, 'Home page did not load.');
  const html = await home.text();
  assert(html.includes('GoldRoad'), 'Home page is missing the GoldRoad title.');
  assert(
    html.includes(`${baseUrl.origin}/icons/og-1200x630.png`),
    'Home page is missing an absolute Open Graph image URL.',
  );
  assert(html.includes('noindex, nofollow'), 'Staging is missing noindex.');

  const currentResponse = await get('/api/games/current');
  assert(currentResponse.ok, 'Current-road API did not load.');
  const current = CurrentGamesResponseSchema.parse(await currentResponse.json());
  assert(current.classic, 'Classic road is missing.');
  assert(current.expedition, 'Expedition road is missing.');
  assert(
    current.classic.gameNo === current.expedition.gameNo,
    'Classic and Expedition are on different road numbers.',
  );

  for (const path of ['/stats', '/games', '/about']) {
    const response = await get(path);
    assert(response.ok, `${path} did not load.`);
  }

  const manifest = await get('/manifest.webmanifest');
  assert(manifest.ok, 'Web app manifest did not load.');
  const manifestJson = (await manifest.json()) as {
    name?: string;
    icons?: unknown[];
  };
  assert(manifestJson.name === 'GoldRoad', 'Manifest name is incorrect.');
  assert(manifestJson.icons?.length, 'Manifest icons are missing.');

  const shareImage = await get('/icons/og-1200x630.png');
  assert(shareImage.ok, 'Open Graph image did not load.');

  const robots = await get('/robots.txt');
  assert(robots.ok, 'robots.txt did not load.');
  assert(
    (await robots.text()).includes('Disallow: /'),
    'Staging robots.txt does not block crawling.',
  );

  const legacySignIn = await get('/sign-in', { redirect: 'manual' });
  assert(legacySignIn.status === 301, '/sign-in did not return a 301 redirect.');
  assert(
    legacySignIn.headers.get('location') === '/about',
    '/sign-in did not redirect to /about.',
  );

  if (shouldWriteAnalytics) {
    const hintResponse = await get('/api/session/hint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerUUID: testPlayerUUID,
        gameNo: current.classic.gameNo,
        puzzleType: 'classic',
        sessionId: testSessionId,
        attemptNumber: 1,
        pathHistory: [current.classic.board.start],
      }),
    });
    assert(hintResponse.ok, 'Live hint request failed.');
    z.object({ ok: z.literal(true), hint: HintResultSchema }).parse(
      await hintResponse.json(),
    );

    const sessionResponse = await get('/api/session/end', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerUUID: testPlayerUUID,
        gameNo: current.classic.gameNo,
        puzzleType: 'classic',
        sessionId: testSessionId,
        score: current.classic.maxScore,
        moves: 1,
        attemptNumber: 1,
        solved: true,
        endReason: 'solved',
        hintsUsed: 1,
        solveTimeMs: 1000,
      }),
    });
    assert(sessionResponse.ok, 'Live session-end request failed.');
    z.object({
      ok: z.literal(true),
      gameNo: z.number().int().positive(),
      medal: z.literal('gold'),
      score: z.number().int().positive(),
      solved: z.literal(true),
    }).parse(await sessionResponse.json());

    console.log(`Synthetic analytics write passed for ${testPlayerUUID}.`);
  }

  console.log(
    `Deployed staging smoke passed for Road ${current.classic.gameNo}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
