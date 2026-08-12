import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generatePuzzle } from '../server/utils/puzzleGenerator';

const ALLOWED_TARGETS = new Map([
  ['staging', 'goldroad-v2-staging'],
  ['production', 'goldroad-v2-production'],
]);
const POOL_BUFFER_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function readArgument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runWrangler(args: string[], inheritOutput = false) {
  const wrangler = resolve(
    `node_modules/.bin/wrangler${process.platform === 'win32' ? '.cmd' : ''}`,
  );
  const result = spawnSync(wrangler, args, {
    cwd: resolve('.'),
    encoding: 'utf8',
    stdio: inheritOutput ? 'inherit' : 'pipe',
  });

  if (result.status !== 0) {
    if (!inheritOutput) {
      process.stderr.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }
    throw new Error(`Wrangler exited with status ${result.status ?? 'unknown'}`);
  }

  return result.stdout ?? '';
}

function findRowCount(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRowCount(item);
      if (found !== null) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.rowCount === 'number') return record.rowCount;

    for (const item of Object.values(record)) {
      const found = findRowCount(item);
      if (found !== null) return found;
    }
  }

  return null;
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toSqlString(value: string | null) {
  if (value === null) return 'NULL';
  return `'${value.replaceAll("'", "''")}'`;
}

function addDaysIso(value: string, days: number) {
  return new Date(new Date(value).getTime() + days * DAY_MS).toISOString();
}

export function buildRoadSchedule(
  startAt: string,
  firstRoadDays: number,
  poolBufferDays = POOL_BUFFER_DAYS,
) {
  if (!Number.isInteger(firstRoadDays) || firstRoadDays < 1) {
    throw new Error('firstRoadDays must be a positive integer.');
  }

  return Array.from({ length: poolBufferDays + 1 }, (_, offset) => {
    const gameNo = offset + 1;
    const playableOffset = offset === 0 ? 0 : firstRoadDays + offset - 1;
    const playableAt = addDaysIso(startAt, playableOffset);

    return {
      gameNo,
      playableAt,
      nextGameAt:
        offset === 0 ? addDaysIso(startAt, firstRoadDays) : null,
    };
  });
}

function buildInsertRow(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  isCurrent: boolean,
  playableAt: string,
  nextGameAt: string | null,
) {
  const puzzle = generatePuzzle(puzzleType);
  if (!puzzle) {
    throw new Error(
      `Failed to generate ${puzzleType} puzzle for game ${gameNo}`,
    );
  }

  return `(
  ${gameNo},
  ${toSqlString(puzzleType)},
  ${toSqlString(JSON.stringify(puzzle.board))},
  ${toSqlString(JSON.stringify(puzzle.optimalPaths))},
  ${puzzle.maxScore},
  ${puzzle.totalCoins},
  ${puzzle.goldSilverGap},
  1,
  ${isCurrent ? 1 : 0},
  ${toSqlString(playableAt)},
  ${toSqlString(nextGameAt)}
)`;
}

function buildBootstrapSql(
  database: string,
  startAt: string,
  firstRoadDays: number,
) {
  const originalRandom = Math.random;
  Math.random = mulberry32(hashSeed(`${database}:${startAt}`));

  try {
    const rows: string[] = [];
    for (const road of buildRoadSchedule(startAt, firstRoadDays)) {
      const isCurrent = road.gameNo === 1;
      rows.push(
        buildInsertRow(
          road.gameNo,
          'classic',
          isCurrent,
          road.playableAt,
          road.nextGameAt,
        ),
      );
      rows.push(
        buildInsertRow(
          road.gameNo,
          'expedition',
          isCurrent,
          road.playableAt,
          road.nextGameAt,
        ),
      );
    }

    return `-- One-time GoldRoad remote bootstrap. Refuses to run on a non-empty games table.
INSERT INTO games (
  game_no,
  puzzle_type,
  board_json,
  optimal_paths_json,
  max_score,
  total_coins,
  gold_silver_gap,
  active,
  current,
  playable_at,
  next_game_at
) VALUES
${rows.join(',\n')};
`;
  } finally {
    Math.random = originalRandom;
  }
}

function main() {
  const environment = readArgument('env');
  const database = readArgument('database');
  const firstRoadDays = Number.parseInt(
    readArgument('first-road-days') ?? '1',
    10,
  );
  const expectedDatabase = environment
    ? ALLOWED_TARGETS.get(environment)
    : undefined;

  if (!environment || !database || expectedDatabase !== database) {
    throw new Error(
      'Pass a supported matching target, for example: --env staging --database goldroad-v2-staging',
    );
  }
  if (!Number.isInteger(firstRoadDays) || firstRoadDays < 1) {
    throw new Error('--first-road-days must be a positive integer.');
  }

  const queryOutput = runWrangler([
    'd1',
    'execute',
    database,
    '--remote',
    '--command',
    'SELECT COUNT(*) AS rowCount FROM games',
    '--json',
    '--config',
    'wrangler.jsonc',
    '--env',
    environment,
  ]);
  const rowCount = findRowCount(JSON.parse(queryOutput));

  if (rowCount === null) {
    throw new Error('Could not read the remote games row count.');
  }
  if (rowCount !== 0) {
    throw new Error(
      `Refusing to bootstrap ${database}: games already contains ${rowCount} rows.`,
    );
  }

  const now = new Date();
  const startAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'goldroad-bootstrap-'));
  const sqlPath = join(temporaryDirectory, `${environment}.sql`);

  try {
    writeFileSync(
      sqlPath,
      buildBootstrapSql(database, startAt, firstRoadDays),
      'utf8',
    );
    runWrangler(
      [
        'd1',
        'execute',
        database,
        '--remote',
        '--file',
        sqlPath,
        '--yes',
        '--config',
        'wrangler.jsonc',
        '--env',
        environment,
      ],
      true,
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  console.log(
    `Bootstrapped ${database} with Road 1 current for ${firstRoadDays} day(s) and ${POOL_BUFFER_DAYS} future road days from ${startAt}.`,
  );
}

if (import.meta.url === new URL(process.argv[1]!, 'file:').href) {
  main();
}
