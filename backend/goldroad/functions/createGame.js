// Generate a random number between min (included) & max (excluded)
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
      if (key === 'prevNode' && neighbor.wall !== 2 && srcNode.wall !== 4) {
        addJob(jobs, [row, col - 1], job);
      }

      if (key === 'nextNode' && neighbor.wall !== 4 && srcNode.wall !== 2) {
        addJob(jobs, [row, col + 1], job);
      }

      if (key === 'topNode' && neighbor.wall !== 3 && srcNode.wall !== 1) {
        addJob(jobs, [row - 1, col], job);
      }

      if (key === 'bottomNode' && neighbor.wall !== 1 && srcNode.wall !== 3) {
        addJob(jobs, [row + 1, col], job);
      }
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
    results.sort((result1, result2) => {
      return result2.total - result1.total;
    });

    return results[0];
  } else {
    console.log(`No valid path found`);
  }
};

exports = async function (req) {
  let maxRows = 6;
  let maxCols = 6;
  let walls = 2;

  let reqBody = null;
  if (req) {
    if (req.body) {
      console.log(`got a req body: ${req.body.text()}`);
      reqBody = JSON.parse(req.body.text());
      if (reqBody.rows) {
        maxRows = reqBody.rows;
      }

      if (reqBody.cols) {
        maxCols = reqBody.cols;
      }

      if (reqBody.walls) {
        walls = reqBody.walls;
      }
    } else {
      console.log(`got a req without req body: ${JSON.stringify(req)}`);
    }
  }

  const coins = [];
  for (let row = 0; row < maxRows; row++) {
    coins.push([]);

    const blockages = getCoinsWithWalls(0, maxCols, walls);
    for (let col = 0; col < maxCols; col++) {
      const coin = {
        id: `${row}${col}`,
        value: randomInt(1, 7),
        wall: 0,
      };

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

  console.log(
    `min-max start rows: (${minStartRow}, ${maxStartRow}), cols: (${minStartCol}, ${maxStartCol})`
  );

  const start = `${randomInt(minStartRow, maxStartRow)}${randomInt(
    minStartCol,
    maxStartCol
  )}`;
  let end = randomInt(1, 5);
  if (end === 1) {
    end = '00';
  } else if (end === 2) {
    end = `0${maxCols - 1}`;
  } else if (end === 3) {
    end = `${maxRows - 1}0`;
  } else {
    end = `${maxRows - 1}${maxCols - 1}`;
  }

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
  console.log(
    `Total time taken for finding bestRoute: ${Date.now() - startTime} ms`
  );

  if (bestMove) {
    console.log(`best path: ${JSON.stringify(bestMove)}`);
    gameEntry.maxScore = bestMove.total;
    gameEntry.maxScoreMoves = bestMove.moves;
    gameEntry.hints = bestMove.path;

    console.log(`context.environment: ${JSON.stringify(context.environment)}`);

    const { serviceName, dbName } = context.environment.values;

    const mongoDb = context.services.get(serviceName).db(dbName);
    const gamesCollection = mongoDb.collection('games');
    const appCollection = mongoDb.collection('app');
    const config = await appCollection.findOne({ type: 'config' });

    console.log('fetch config data:', JSON.stringify(config));
    console.log('lastPlayableGame:', config.lastPlayableGame);

    if (config) {
      if (config.lastPlayableGame) {
        const lastPlayableDate = config.lastPlayableGame.playableAt;
        lastPlayableDate.setUTCDate(lastPlayableDate.getDate() + 1);

        gameEntry.playableAt = lastPlayableDate;
        gameEntry.gameNo =
          reqBody?.gameNo || config.lastPlayableGame.gameNo + 1;
        if (reqBody) {
          if (reqBody.active) {
            gameEntry.active = true;
          }

          if (reqBody.current) {
            const nextGameAt = new Date(config.lastPlayableGame.playableAt);
            nextGameAt.setUTCDate(nextGameAt.getDate() + 2);
            gameEntry.current = true;
            gameEntry.nextGameAt = nextGameAt;
          }
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
    console.log(
      `Successfully inserted game with _id: ${JSON.stringify(result)}`
    );

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
      }
    );

    console.log('result of update operation: ', JSON.stringify(result));
  }

  return gameEntry;
};
