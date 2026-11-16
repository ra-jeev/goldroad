import { expect, test, type Page } from '@playwright/test';
import type { CurrentGamesResponse } from '../../shared/types/game';
import { buildEdgeMap, getActiveNeighbors } from '../../shared/utils/puzzleEngine';
import { findAllRoutes } from '../../server/utils/pathfinder';

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

test('short screens show one visible start notification after hydration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const runtimeErrors = captureRuntimeErrors(page);
  const response = await page.request.get('/api/games/current');
  expect(response.ok()).toBe(true);
  const { classic } = await response.json() as CurrentGamesResponse;
  expect(classic).toBeTruthy();
  await page.clock.setFixedTime(new Date(classic!.playableAt));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Learn the road' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.locator('.footer-feedback')).toHaveCount(1);
  const toast = page.locator('#teleports .feedback-toast');
  await expect(toast).toContainText('Step onto any glowing tile to begin.');
  await expect(toast).toBeInViewport({ ratio: 0.95 });
  const mute = page.getByRole('button', { name: 'Mute sounds' });
  await expect.poll(() => mute.evaluate((button) => {
    const { left, top, width, height } = button.getBoundingClientRect();
    return Boolean(document.elementFromPoint(left + width / 2, top + height / 2)
      ?.closest('.feedback-toast'));
  })).toBe(true);
  const classicTab = page.getByRole('tab', { name: 'Classic Not solved' });
  const dismiss = toast.getByRole('button', { name: 'Dismiss message' });
  await expect(toast.locator('p')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Step onto any glowing tile to begin.' })).toHaveCount(1);
  await classicTab.focus();
  await dismiss.focus();
  await dismiss.press('Enter');
  await expect(classicTab).toBeFocused();
  await expect(mute).toBeEnabled();
  await mute.click();
  await expect(page.getByRole('button', { name: 'Unmute sounds' })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

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
    'rgb(218, 165, 32)',
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
  await expect(page.getByRole('button', { name: 'Play the new road' })).toBeHidden();

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

test('rollover waits for publication and switches only on request', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const runtimeErrors = captureRuntimeErrors(page);
  const roadDay = await (await page.request.get('/api/games/current')).json() as CurrentGamesResponse;
  const classic = roadDay.classic!;
  const cutoff = new Date(classic.nextGameAt!);
  let published = false;
  let checks = 0;
  await page.clock.install({ time: new Date(cutoff.getTime() - 120_000) });
  await page.route('**/api/games/current', (route) => {
    checks++;
    if (!published) return route.fulfill({ json: roadDay });
    return route.fulfill({ json: {
      classic: {
        ...classic,
        gameNo: classic.gameNo + 1,
        playableAt: cutoff.toISOString(),
        nextGameAt: new Date(cutoff.getTime() + 86_400_000).toISOString(),
      },
      expedition: null,
    } });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Learn the road' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const newRoad = page.getByRole('button', { name: 'Play the new road' });
  const check = page.locator('.play-actions').getByRole('button', { name: 'Check for new road' });
  const toast = page.locator('#teleports .feedback-toast');
  await page.locator('.board-column .tile.active').first().click();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const retryDialog = page.getByRole('dialog', { name: 'Start over?' });
  await expect(retryDialog).toBeVisible();
  await expect(newRoad).toBeHidden();
  await page.clock.fastForward(121_000);
  await expect.poll(() => checks).toBeGreaterThan(0);
  await expect(newRoad).toBeHidden();
  await expect(retryDialog).toBeHidden();
  await expect(check).toBeFocused();
  const notice = page.locator('.rollover-notice');
  await expect(notice).toContainText('You can still finish this road and save it to Past Roads.');
  await expect(toast).toHaveCount(0);
  await expect.poll(() => notice.evaluate((element) => {
    const score = document.querySelector('.metric-line')!.getBoundingClientRect();
    const board = document.querySelector('.board-wrapper')!.getBoundingClientRect();
    const banner = element.getBoundingClientRect();
    return banner.top >= score.bottom && banner.bottom <= board.top;
  })).toBe(true);
  await expect(page.getByText(`Day #${classic.gameNo}`, { exact: true })).toBeVisible();

  await check.click();
  await expect(toast).toHaveText('The new road is still being prepared.');
  published = true;
  await check.click();
  await expect(page.locator('.play-actions').getByRole('button', { name: 'Play the new road' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText(`Day #${classic.gameNo}`, { exact: true })).toBeVisible();
  await newRoad.click();
  await expect(page.getByText(`Day #${classic.gameNo + 1}`, { exact: true })).toBeVisible();
  await expect(newRoad).toBeHidden();
  await expect(notice).toBeEmpty();
  await expect(
    page.getByRole('tab', { name: 'Classic Not solved' }),
  ).toBeEnabled();
  expect(runtimeErrors).toEqual([]);
});

test('a stale solve preserves daily attempts and only marks archive completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const roadDay = await (await page.request.get('/api/games/current')).json() as CurrentGamesResponse;
  const classic = roadDay.classic!;
  const path = findAllRoutes(classic.board).find(({ total }) => total === classic.maxScore)!.path;
  const cutoff = new Date(classic.nextGameAt!);
  let submittedSolves = 0;
  await page.clock.install({ time: new Date(cutoff.getTime() - 120_000) });
  await page.route('**/api/session/start', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/session/end', (route) => {
    submittedSolves++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Learn the road' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const tiles = page.locator('.board-column .tile');
  for (let i = 0; i < 2; i++) {
    await tiles.nth(path[1]!).click();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('dialog', { name: 'Start over?' }).getByRole('button', { name: 'Try again' }).click();
    await expect(tiles.nth(path[0]!)).toHaveClass(/\bcurrent\b/);
  }

  const storedResult = () => page.evaluate(({ gameNo, day }) => {
    const state = JSON.parse(localStorage.getItem('goldroad-state-v2') ?? '{}');
    return {
      daily: state.historyByDay?.[day]?.modes?.classic,
      archived: state.archiveCompletionByGame?.[gameNo]?.classic,
    };
  }, { gameNo: classic.gameNo, day: classic.playableAt.split('T')[0]! });
  const before = await storedResult();
  expect(before.daily).toMatchObject({ attempts: 2, solved: false });
  expect(before.archived).toBeUndefined();
  await page.clock.fastForward(121_000);
  await expect(page.getByRole('button', { name: 'Check for new road' })).toBeVisible();

  // A first move made after cutoff still works on the already-open board.
  for (const index of path.slice(1)) {
    await tiles.nth(index).click();
  }
  const solveToast = page.locator('#teleports .feedback-toast');
  await expect(solveToast).toHaveText('Solved. Saved to Past Roads.');
  await expect(solveToast).toBeInViewport({ ratio: 0.95 });
  await expect(page.getByRole('status').filter({ hasText: 'Solved. Saved to Past Roads.' })).toHaveCount(1);
  expect(await storedResult()).toEqual({ daily: before.daily, archived: true });
  expect(submittedSolves).toBe(0);

  // The same response must not open the old road on a fresh load.
  await page.reload();
  await expect(page.getByText('The new road is still being prepared.')).toBeVisible();
  await expect(page.locator('.board-column')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
});

test('a stale dead end shows the outcome without offering another daily try', async ({ page }) => {
  const { classic } = await (await page.request.get('/api/games/current')).json() as CurrentGamesResponse;
  const { board, nextGameAt, playableAt } = classic!;
  const edges = buildEdgeMap(board);

  function findDeadEnd(path: number[]): number[] | null {
    const current = path.at(-1)!;
    if (current === board.end) return null;
    const neighbors = getActiveNeighbors(current, board.rows, board.cols, edges, new Set(path));
    if (!neighbors.length) return path;
    for (const neighbor of neighbors) {
      const result = findDeadEnd([...path, neighbor]);
      if (result) return result;
    }
    return null;
  }

  const path = findDeadEnd([board.start])!;
  const cutoff = Date.parse(nextGameAt!);
  await page.clock.install({ time: new Date(cutoff - 120_000) });
  await page.route('**/api/session/start', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Learn the road' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const tiles = page.locator('.board-column .tile');
  await tiles.nth(path[1]!).click();
  await page.clock.fastForward(121_000);
  await expect(page.getByRole('button', { name: 'Check for new road' })).toBeVisible();
  for (const index of path.slice(2)) await tiles.nth(index).click();

  await expect(page.locator('#teleports .feedback-toast p')).toHaveText('Dead end.');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
  const attempts = await page.evaluate((day) => {
    const state = JSON.parse(localStorage.getItem('goldroad-state-v2') ?? '{}');
    return state.historyByDay?.[day]?.modes?.classic?.attempts ?? 0;
  }, playableAt.split('T')[0]!);
  expect(attempts).toBe(0);
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

test('reloading a saved route twice preserves the try', async ({ page }) => {
  await page.goto('/games/1');
  const road = await page.request.get('/api/games/1/board');
  const { classic } = await road.json() as CurrentGamesResponse;
  const nextTile = classic?.optimalPaths?.[0]?.[1];
  expect(nextTile).toBeDefined();

  const tile = page.locator('.board-column .tile').nth(nextTile!);
  await expect(tile).toHaveClass(/\bactive\b/);
  await tile.click();
  const score = page.locator('.score-target strong').first();
  const savedScore = await score.innerText();
  const undo = page.getByRole('button', { name: 'Undo last step' });

  for (let reload = 0; reload < 2; reload++) {
    await page.reload();
    await expect(tile).toHaveClass(/\bcurrent\b/);
    await expect(score).toHaveText(savedScore);
    await expect(undo).toBeEnabled();
    const attempts = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('goldroad-replay-progress-v2') ?? '{}');
      return progress['classic:1']?.attempts;
    });
    expect(attempts).toBe(0);
  }
});

test('failed road counts visible time until retry', async ({ page }) => {
  const response = await page.request.get('/api/games/1/board');
  const road = await response.json() as CurrentGamesResponse;
  const classic = road.classic!;
  const path = classic.optimalPaths![0]!;
  await page.route('**/api/games/1/board', (route) =>
    route.fulfill({ json: { ...road, classic: { ...classic, maxScore: classic.maxScore + 1 } } }),
  );
  await page.clock.install();
  await page.goto('/games/1');

  const tiles = page.locator('.board-column .tile');
  for (const index of path.slice(1)) {
    await expect(tiles.nth(index)).toHaveClass(/\bactive\b/);
    await tiles.nth(index).click();
  }

  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await expect(retry).toBeEnabled();
  const readProgress = () => page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('goldroad-replay-progress-v2') ?? '{}');
    return progress['classic:1'] as {
      attempts: number;
      activeTimeMs: number;
      timerStartedAt: string | null;
    };
  });

  const failed = await readProgress();
  expect(failed.attempts).toBe(1);
  expect(failed.timerStartedAt).not.toBeNull();
  await page.clock.fastForward(5_000);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = await readProgress();
  expect(paused.timerStartedAt).toBeNull();
  expect(paused.activeTimeMs - failed.activeTimeMs).toBeGreaterThanOrEqual(5_000);
  await page.clock.fastForward(60_000);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5_000);
  await retry.click();

  const restarted = await readProgress();
  expect(restarted.attempts).toBe(1);
  expect(restarted.activeTimeMs - paused.activeTimeMs).toBeGreaterThanOrEqual(5_000);
  expect(restarted.activeTimeMs - paused.activeTimeMs).toBeLessThan(60_000);
  await expect(tiles.nth(classic.board.start)).toHaveClass(/\bcurrent\b/);
});
