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

function buildInsertRow(
  gameNo: number,
  puzzleType: 'classic' | 'expedition',
  isCurrent: boolean,
  playableAt: string,
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
  ${toSqlString(isCurrent ? addDaysIso(playableAt, 1) : null)}
)`;
}

function buildBootstrapSql(database: string, startAt: string) {
  const originalRandom = Math.random;
  Math.random = mulberry32(hashSeed(`${database}:${startAt}`));

  try {
    const rows: string[] = [];
    for (let offset = 0; offset <= POOL_BUFFER_DAYS; offset++) {
      const gameNo = offset + 1;
      const playableAt = addDaysIso(startAt, offset);
      rows.push(buildInsertRow(gameNo, 'classic', offset === 0, playableAt));
      rows.push(
        buildInsertRow(gameNo, 'expedition', offset === 0, playableAt),
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
  const expectedDatabase = environment
    ? ALLOWED_TARGETS.get(environment)
    : undefined;

  if (!environment || !database || expectedDatabase !== database) {
    throw new Error(
      'Pass a supported matching target, for example: --env staging --database goldroad-v2-staging',
    );
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
    writeFileSync(sqlPath, buildBootstrapSql(database, startAt), 'utf8');
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
    `Bootstrapped ${database} with Road 1 current and ${POOL_BUFFER_DAYS} future road days from ${startAt}.`,
  );
}

main();
