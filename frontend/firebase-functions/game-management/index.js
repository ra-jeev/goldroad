const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { connectToDatabase } = require('../common/mongo');
const { getMessaging } = require('firebase-admin/messaging');

const TOPIC_NAME = 'newPuzzle';

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
};

const getCoinsWithWalls = (start, end, count) => {
  const coinColIndices = [];
  while (coinColIndices.length < count) {
    const index = randomInt(start, end);
    if (!coinColIndices.includes(index)) {
      coinColIndices.push(index);
    }
  }
  return coinColIndices;
};

const addJob = (jobs, src, currJob) => {
  jobs.push({
    coins: JSON.parse(JSON.stringify(currJob.coins)),
    src,
    dst: currJob.dst,
    pastMoves: JSON.parse(JSON.stringify(currJob.pastMoves)),
    total: currJob.total,
  });
};

const handleJob = (jobs, job) => {
  const row = job.src[0];
  const col = job.src[1];
  const srcNode = job.coins[row][col];
  const maxRows = job.coins.length;
  const maxCols = job.coins[0].length;

  srcNode.finished = true;
  if (row === job.dst[0] && col === job.dst[1]) {
    job.total += srcNode.value;
    job.pastMoves.push(`${job.dst[0]}${job.dst[1]}`);
    return true;
  }

  const neighbors = {
    prevNode: col > 0 ? job.coins[row][col - 1] : null,
    nextNode: col < maxCols - 1 ? job.coins[row][col + 1] : null,
    topNode: row > 0 ? job.coins[row - 1][col] : null,
    bottomNode: row < maxRows - 1 ? job.coins[row + 1][col] : null,
  };

  job.total += srcNode.value;
  job.pastMoves.push(srcNode.id);

  for (const key in neighbors) {
    const neighbor = neighbors[key];
    if (neighbor && !neighbor.finished) {
      if (key === 'prevNode' && neighbor.wall !== 2 && srcNode.wall !== 4)
        addJob(jobs, [row, col - 1], job);
      if (key === 'nextNode' && neighbor.wall !== 4 && srcNode.wall !== 2)
        addJob(jobs, [row, col + 1], job);
      if (key === 'topNode' && neighbor.wall !== 3 && srcNode.wall !== 1)
        addJob(jobs, [row - 1, col], job);
      if (key === 'bottomNode' && neighbor.wall !== 1 && srcNode.wall !== 3)
        addJob(jobs, [row + 1, col], job);
    }
  }
  return false;
};

const findBestRoute = (coins, start, end) => {
  const src = [parseInt(start[0]), parseInt(start[1])];
  const dst = [parseInt(end[0]), parseInt(end[1])];
  const jobs = [{ coins, src, dst, pastMoves: [], total: 0 }];
  const results = [];

  while (jobs.length) {
    const job = jobs.shift();
    if (handleJob(jobs, job)) {
      results.push({
        total: job.total,
        moves: job.pastMoves.length,
        path: job.pastMoves,
      });
    }
  }

  if (results.length) {
    results.sort((r1, r2) => r2.total - r1.total);
    return results[0];
  }
  logger.warn('No valid path found');
};

const _createGame = async (data = {}) => {
  const maxRows = data.rows || 6;
  const maxCols = data.cols || 6;
  const walls = data.walls || 2;

  const coins = [];
  for (let row = 0; row < maxRows; row++) {
    coins.push([]);
    const blockages = getCoinsWithWalls(0, maxCols, walls);
    for (let col = 0; col < maxCols; col++) {
      const coin = { id: `${row}${col}`, value: randomInt(1, 7), wall: 0 };
      if (blockages.includes(col)) {
        coin.wall = randomInt(1, 5);
      }
      coins[row].push(coin);
    }
  }

  const minStartRow = parseInt(maxRows / 2 - 1);
  const maxStartRow = maxRows - minStartRow;
  const minStartCol = parseInt(maxCols / 2 - 1);
  const maxStartCol = maxCols - minStartCol;

  logger.log(
    `min-max start rows: (${minStartRow}, ${maxStartRow}), cols: (${minStartCol}, ${maxStartCol})`,
  );

  const start = `${randomInt(minStartRow, maxStartRow)}${randomInt(minStartCol, maxStartCol)}`;
  let end = randomInt(1, 5);
  if (end === 1) end = '00';
  else if (end === 2) end = `0${maxCols - 1}`;
  else if (end === 3) end = `${maxRows - 1}0`;
  else end = `${maxRows - 1}${maxCols - 1}`;

  const date = new Date();
  const gameEntry = {
    coins,
    start,
    end,
    active: false,
    createdAt: date,
    updatedAt: date,
  };

  const startTime = Date.now();
  const bestMove = findBestRoute(JSON.parse(JSON.stringify(coins)), start, end);
  logger.log(
    `Total time taken for finding bestRoute: ${Date.now() - startTime} ms`,
  );

  if (bestMove) {
    logger.log(`best path: ${JSON.stringify(bestMove)}`);
    gameEntry.maxScore = bestMove.total;
    gameEntry.maxScoreMoves = bestMove.moves;
    gameEntry.hints = bestMove.path;

    const { db } = await connectToDatabase();
    const gamesCollection = db.collection('games');
    const appCollection = db.collection('app');
    const config = await appCollection.findOne({ type: 'config' });

    logger.log('fetch config data:', config);
    
    if (config) {
      logger.log('lastPlayableGame:', config.lastPlayableGame);
      if (config.lastPlayableGame) {
        const lastPlayableDate = new Date(config.lastPlayableGame.playableAt);
        lastPlayableDate.setUTCDate(lastPlayableDate.getDate() + 1);
        gameEntry.playableAt = lastPlayableDate;
        gameEntry.gameNo = data.gameNo || config.lastPlayableGame.gameNo + 1;
        if (data.active) gameEntry.active = true;

        if (data.current) {
          const nextGameAt = new Date(config.lastPlayableGame.playableAt);
          nextGameAt.setUTCDate(nextGameAt.getDate() + 2);
          gameEntry.current = true;
          gameEntry.nextGameAt = nextGameAt;
        }
      } else {
        const playableDate = new Date();
        playableDate.setUTCHours(0, 0, 0, 0);
        gameEntry.playableAt = playableDate;
        gameEntry.gameNo = 1;
        gameEntry.current = true;
        gameEntry.active = true;
      }
    }

    let result = await gamesCollection.insertOne(gameEntry);
    logger.log(`Successfully inserted game with _id: ${result.insertedId}`);

    result = await appCollection.updateOne(
      { type: 'config' },
      {
        $set: {
          lastPlayableGame: {
            playableAt: gameEntry.playableAt,
            gameNo: gameEntry.gameNo,
            _id: result.insertedId,
          },
        },
      },
    );
    logger.log('result of update operation: ', result);

    // Now, convert dates to strings before returning to the client
    gameEntry.createdAt = gameEntry.createdAt.toISOString();
    gameEntry.updatedAt = gameEntry.updatedAt.toISOString();
    if (gameEntry.playableAt)
      gameEntry.playableAt = gameEntry.playableAt.toISOString();
    if (gameEntry.nextGameAt)
      gameEntry.nextGameAt = gameEntry.nextGameAt.toISOString();
  }
  return gameEntry;
};

exports.changeGame = onSchedule(
  { schedule: '0 0 * * *', memory: '512MiB' },
  async () => {
    logger.log('Executing scheduled game change.');

    const { db } = await connectToDatabase();
    const gamesCollection = db.collection('games');
    const currGame = await gamesCollection.findOne({ current: true });

    if (currGame) {
      logger.log(
        `got the current game: ${currGame.gameNo}, nextGameAt: ${currGame.nextGameAt}`,
      );
      const date = new Date();
      let nextGameDate;
      if (currGame.nextGameAt) {
        nextGameDate = new Date(currGame.nextGameAt);
        nextGameDate.setUTCDate(nextGameDate.getDate() + 1);
      } else {
        nextGameDate = new Date(currGame.playableAt);
        nextGameDate.setUTCDate(nextGameDate.getDate() + 2);
      }

      const bulkWriteResult = await gamesCollection.bulkWrite(
        [
          {
            updateOne: {
              filter: { gameNo: currGame.gameNo + 1 },
              update: {
                $set: {
                  current: true,
                  active: true,
                  updatedAt: date,
                  playedAt: date,
                  nextGameAt: nextGameDate,
                  prevGameStats: {
                    gameNo: currGame.gameNo,
                    stats: currGame.stats,
                  },
                },
              },
            },
          },
          {
            updateOne: {
              filter: { _id: currGame._id },
              update: { $set: { current: false, updatedAt: date } },
            },
          },
        ],
        { ordered: true },
      );

      logger.log('after the bulkWrite Op', bulkWriteResult);

      if (bulkWriteResult.isOk()) {
        const newGameNo = currGame.gameNo + 1;
        const messageId = await getMessaging().send({
          notification: {
            title: `GoldRoad #${newGameNo} is live`,
            body: 'Get your walking boots on!',
          },
          webpush: {
            headers: { TTL: '86400' },
            notification: {
              icon: `https://playgoldroad.com/icon-192.png`,
              renotify: true,
              tag: TOPIC_NAME,
            },
            fcm_options: { link: `https://playgoldroad.com` },
          },
          topic: TOPIC_NAME,
        });
        logger.log(`messaged sent to the topic with message id: ${messageId}`);
      }

      logger.log(`Creating a new game now`);
      await _createGame();
    } else {
      logger.error('Error! No current game found.');
    }
  },
);

exports.createGame = onCall(async (request) => {
  return await _createGame(request.data);
});
