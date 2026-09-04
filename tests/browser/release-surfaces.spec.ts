import { expect, test, type Page } from '@playwright/test';
import type { CurrentGamesResponse } from '../../shared/types/game';

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
}

test('live board and tutorial are usable', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  const response = await page.goto('/');
  const serverHtml = await response?.text();
  expect(serverHtml).toContain('class="board-column"');
  expect(serverHtml).not.toContain('class="loading-card"');

  await expect(
    page.getByRole('heading', { name: 'Learn the road' }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: '1. Guide' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: '2. Practice Road' }).click();
  await expect(page.locator('#tutorial-practice-panel')).toBeVisible();
  await expect(
    page.locator('#tutorial-practice-panel').getByRole('button', { name: 'Hint' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('region', { name: 'Road controls' })).toBeVisible();
  await expect(page.locator('.metric-line')).toContainText(
    /Score\s*\d+\s*\/\s*Target\s*\d+\s*•\s*Board\s*\d+/,
  );
  await expect(page.locator('.target-value')).toHaveCSS(
    'color',
    'rgba(218, 165, 32, 0.72)',
  );
  // The seed board is freshly generated, so the start tile's coin value
  // varies from run to run. Match the marker, not the number.
  await expect(
    page.getByRole('button', { name: /Start: footprints$/ }),
  ).toBeVisible();
  const ordinaryTile = page.locator('.tile:not(.active):not(.current)').first();
  await ordinaryTile.evaluate((tile) => {
    (window as typeof window & { deniedAnimationStarts?: number })
      .deniedAnimationStarts = 0;
    tile.addEventListener('animationstart', (event) => {
      if ((event as AnimationEvent).animationName.includes('tile-denied')) {
        (window as typeof window & { deniedAnimationStarts: number })
          .deniedAnimationStarts += 1;
      }
    });
  });
  await ordinaryTile.click();
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { deniedAnimationStarts?: number })
      .deniedAnimationStarts ?? 0,
  )).toBe(1);
  await ordinaryTile.click();
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { deniedAnimationStarts?: number })
      .deniedAnimationStarts ?? 0,
  )).toBe(2);
  await expect(ordinaryTile).toHaveCSS('touch-action', 'manipulation');
  await expect(ordinaryTile).toHaveCSS('user-select', 'none');
  await expect(page.getByRole('button', { name: 'Play the new road' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('returning player hydration restores an unlocked Expedition', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      'goldroad-state-v2',
      JSON.stringify({
        version: 2,
        playerUUID: '00000000-0000-4000-8000-000000000003',
        settings: { muted: false },
        currentRoadContext: {
          currentGameNo: 3,
          currentDay: '2026-01-03',
          selectedMode: 'expedition',
        },
        puzzleProgressByKey: {
          'classic:3': {
            day: '2026-01-03',
            gameNo: 3,
            puzzleType: 'classic',
            attempts: 1,
            solved: true,
            hintsUsed: 0,
            solveTimeMs: 60_000,
            activeTimeMs: 60_000,
            timerStartedAt: null,
            guidePath: [],
            updatedAt: new Date().toISOString(),
          },
        },
        replayProgressByKey: {},
        historyByDay: {},
        archiveCompletionByGame: {},
        tutorialState: { completed: true, lastSeenAt: new Date().toISOString() },
        celebratedSolveKeys: [],
        v1NoticeDismissed: true,
        lastAcknowledgedUpdateId: null,
      }),
    );
  });

  await page.goto('/');
  await expect(
    page.getByRole('tab', { name: 'Expedition Not solved' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('tab', { name: 'Classic Gold medal' }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('Play the new road replaces the expired board without navigation', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.route('**/api/games/current', async (route) => {
    // The initial request runs inside SSR and is deliberately invisible to
    // page.route. This handler sees only the client-side new-road request.
    const response = await route.fetch();
    const roadDay = (await response.json()) as CurrentGamesResponse;
    const nextGameAt = new Date(Date.now() + 86_400_000).toISOString();
    const promote = (game: NonNullable<CurrentGamesResponse['classic']>) => ({
      ...game,
      gameNo: game.gameNo + 1,
      playableAt: new Date().toISOString(),
      nextGameAt,
    });
    roadDay.classic = roadDay.classic ? promote(roadDay.classic) : null;
    roadDay.expedition = roadDay.expedition
      ? promote(roadDay.expedition)
      : null;

    await route.fulfill({ response, json: roadDay });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Learn the road' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByText('Day #3')).toBeVisible();
  await page.getByRole('button', { name: 'Play the new road' }).click();

  await expect(page.getByText('Day #4')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Play the new road' }),
  ).toBeHidden();
  await expect(
    page.getByRole('tab', { name: 'Classic Not solved' }),
  ).toBeEnabled();
  expect(runtimeErrors).toEqual([]);
});

test('stats surface loads its core sections', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/stats');

  await expect(
    page.getByRole('heading', { name: 'Stats', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Medals earned' })).toBeVisible();
  // Nothing earned yet, so each tier shows a dash rather than a zero.
  await expect(page.locator('.medal-count').first()).toHaveText('–');
  await expect(page.getByText('Fewer tries, better medal.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Streak' })).toContainText(
    'Solve today’s road to light the flame.',
  );
  await expect(
    page.getByRole('region', {
      name: /Yesterday’s roads, Day #\d+, global stats for Classic/,
    }),
  ).toBeVisible();
  // Today's card, before the day has been walked.
  await expect(
    page.getByRole('heading', { name: 'Waiting to be walked.' }),
  ).toBeVisible();

  // Each mode-scoped panel carries its own switch, and the panel relabels
  // itself when the mode changes.
  const record = page.getByRole('region', { name: 'Classic stats' });
  await expect(record).toBeVisible();
  await record.getByRole('button', { name: 'View Expedition stats' }).click();
  await expect(
    page.getByRole('region', { name: 'Expedition stats' }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

// Seeds solved Classic roads into local history. The seeded database serves
// road 3, so any road number other than 3 or 2 leaves the streak lapsed while
// the solves behind it survive.
async function seedSolvedRoads(
  page: Page,
  gameNos: number[],
  options: { bothModes?: boolean } = {},
) {
  await page.addInitScript((input: { roads: number[]; bothModes: boolean }) => {
    const historyByDay: Record<string, unknown> = {};
    const solvedMode = {
      attempts: 1,
      solved: true,
      hintsUsed: 0,
      solveTimeMs: 60_000,
      updatedAt: new Date().toISOString(),
    };
    for (const gameNo of input.roads) {
      const day = `2026-01-${String(gameNo).padStart(2, '0')}`;
      historyByDay[day] = {
        day,
        gameNo,
        modes: input.bothModes
          ? { classic: solvedMode, expedition: solvedMode }
          : { classic: solvedMode },
      };
    }

    localStorage.setItem(
      'goldroad-state-v2',
      JSON.stringify({
        version: 2,
        playerUUID: '00000000-0000-4000-8000-000000000007',
        settings: { muted: false },
        currentRoadContext: {
          currentGameNo: null,
          currentDay: null,
          selectedMode: null,
        },
        puzzleProgressByKey: {},
        replayProgressByKey: {},
        historyByDay,
        archiveCompletionByGame: {},
        tutorialState: { completed: true, lastSeenAt: new Date().toISOString() },
        celebratedSolveKeys: [],
        v1NoticeDismissed: true,
        lastAcknowledgedUpdateId: null,
      }),
    );
  }, { roads: gameNos, bothModes: options.bothModes ?? false });
}

test('a lapsed streak is nudged by the best run behind it', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await seedSolvedRoads(page, [5, 6, 7]);

  await page.goto('/stats');

  const streak = page.getByRole('region', { name: 'Streak' });
  await expect(streak).toContainText('No streak yet');
  await expect(streak).toContainText(
    'You once did 3 days. Solve today’s road to light it again.',
  );
  expect(runtimeErrors).toEqual([]);
});

test('a lapsed player who never ran two roads together is nudged by the solves', async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);
  // Two solves with a gap between them: the best run is one road, so there is
  // no number of days worth naming, but there are still roads conquered. The
  // count is the solves, not the best run, which stays at one throughout.
  await seedSolvedRoads(page, [5, 7]);

  await page.goto('/stats');

  const streak = page.getByRole('region', { name: 'Streak' });
  await expect(streak).toContainText('No streak yet');
  await expect(streak).toContainText(
    '2 roads conquered so far. Solve one today to make it 3 and light the flame.',
  );
  expect(runtimeErrors).toEqual([]);
});

test('a single lapsed solve counts up from one road', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await seedSolvedRoads(page, [5]);

  await page.goto('/stats');

  await expect(page.getByRole('region', { name: 'Streak' })).toContainText(
    '1 road conquered so far. Solve one today to make it 2 and light the flame.',
  );
  expect(runtimeErrors).toEqual([]);
});

test('both halves of one lapsed day count as two roads', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  // One road day, Classic and Expedition both solved. The app calls that
  // "Both roads conquered.", so the tally says two, not one.
  await seedSolvedRoads(page, [5], { bothModes: true });

  await page.goto('/stats');

  await expect(page.getByRole('region', { name: 'Streak' })).toContainText(
    '2 roads conquered so far. Solve one today to make it 3 and light the flame.',
  );
  expect(runtimeErrors).toEqual([]);
});

test('today stats share grows from Classic to the full day', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('stats-share-seeded')) return;
    sessionStorage.setItem('stats-share-seeded', 'true');
    const day = new Date().toISOString().split('T')[0]!;
    localStorage.setItem(
      'goldroad-state-v2',
      JSON.stringify({
        version: 2,
        playerUUID: '00000000-0000-4000-8000-000000000003',
        settings: { muted: false },
        currentRoadContext: {
          currentGameNo: 3,
          currentDay: day,
          selectedMode: 'classic',
        },
        puzzleProgressByKey: {},
        historyByDay: {
          [day]: {
            day,
            gameNo: 3,
            modes: {
              classic: {
                attempts: 1,
                solved: true,
                hintsUsed: 0,
                solveTimeMs: 64_000,
                updatedAt: new Date().toISOString(),
              },
            },
          },
        },
        archiveCompletionByGame: {},
        tutorialState: { completed: true, lastSeenAt: null },
        celebratedSolveKeys: [],
        v1NoticeDismissed: true,
        lastAcknowledgedUpdateId: null,
      }),
    );
  });

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Classic conquered.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Streak' })).toContainText(
    '1-day streak',
  );
  await expect(page.getByText('1 try · 1m 04s')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share Classic' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Expedition' })).toBeVisible();

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('goldroad-state-v2')!);
    const day = state.currentRoadContext.currentDay;
    state.historyByDay[day].modes.expedition = {
      attempts: 2,
      solved: true,
      hintsUsed: 1,
      solveTimeMs: 125_000,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('goldroad-state-v2', JSON.stringify(state));
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Both roads conquered.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Streak' })).toContainText(
    '1-day streak',
  );
  await expect(page.getByText('2 tries · 2m 05s · 1 hint')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share the day' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Expedition' })).toBeHidden();

  // Defensive state: the product unlock gate makes Expedition-only
  // unreachable today, but presentation should remain correct if that rule
  // changes or local data is repaired independently in the future.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('goldroad-state-v2')!);
    const day = state.currentRoadContext.currentDay;
    delete state.historyByDay[day].modes.classic;
    localStorage.setItem('goldroad-state-v2', JSON.stringify(state));
  });
  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Expedition conquered.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Streak' })).toContainText(
    'No streak yet',
  );
  await expect(
    page.getByRole('button', { name: 'Share Expedition' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Classic' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Past roads calendar exposes playable road days', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/games');

  await expect(page.getByRole('heading', { name: 'Past roads' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Day #1,/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Day #2,/ })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('archived-road replay loads the production board', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/games/1');

  await expect(page.getByRole('region', { name: 'Road controls' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Classic Not solved' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Start: footprints/ }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});
