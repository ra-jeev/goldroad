const {
  onCall,
  onRequest,
  HttpsError,
} = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
// const cors = require('cors');
const { connectToDatabase } = require('../common/mongo');

const accessControlOrigin = process.env.ACCESS_CONTROL_ORIGIN;
// console.log('accessControlOrigin:', accessControlOrigin);
// console.log('process.env:', process.env);
// const corsMiddleware = cors({ origin: accessControlOrigin?.split(',') });

exports.get = onRequest(
  { cors: accessControlOrigin?.split(',') },
  async (request, response) => {
    logger.info('/games/get: Entered...!');

    if (request.method !== 'GET') {
      response
        .status(400)
        .send('Bad request, this endpoint only accepts GET requests');
      return;
    }

    logger.log('request.query:', request.query);
    const filter = request.query.num
      ? { active: true, gameNo: parseInt(request.query.num) }
      : { current: true };

    const { db } = await connectToDatabase();
    const game = await db.collection('games').findOne(filter);
    console.log('game:', game);
    if (game) {
      let cacheTime = 300; // 5 mins local cache time
      let serverCacheTime = 3600;
      if (game.nextGameAt && !request.query.num) {
        const nextGameAtInMs = new Date(game.nextGameAt).getTime();
        logger.log(
          `nextGameAtInMs: ${nextGameAtInMs}, gapInMins: ${(nextGameAtInMs - Date.now()) / 60000}`,
        );

        serverCacheTime =
          parseInt((nextGameAtInMs - Date.now()) / 1000) - cacheTime;
        if (serverCacheTime < 0) serverCacheTime = 0;
        if (serverCacheTime < cacheTime) cacheTime = serverCacheTime;
      }

      logger.log(
        `cacheTime: ${cacheTime}, serverCacheTime: ${serverCacheTime}`,
      );

      if (game.createdAt) game.createdAt = game.createdAt.toISOString();
      if (game.updatedAt) game.updatedAt = game.updatedAt.toISOString();
      if (game.playableAt) game.playableAt = game.playableAt.toISOString();
      if (game.nextGameAt) game.nextGameAt = game.nextGameAt.toISOString();

      response.set(
        'Cache-Control',
        `public, max-age=${cacheTime}, s-maxage=${serverCacheTime}`,
      );

      delete game.hints;
      delete game.maxScoreMoves;
      response.status(200).send(game);
    } else {
      response
        .status(404)
        .send("Couldn't find the requested game. Please try again later.");
    }
  },
);

exports.getRange = onCall(async (request) => {
  const userId = request.auth?.uid;
  const data = request.data;

  if (userId) {
    const filter = { active: true, current: false };

    if (data.gameNo?.startAt) {
      filter.gameNo = { $lte: data.gameNo.startAt };
    }

    const { db } = await connectToDatabase();
    const games = await db
      .collection('games')
      .find(filter, {
        sort: { gameNo: -1 },
        projection: { gameNo: 1, maxScore: 1 },
        limit: data.limit || 15,
      })
      .toArray();

    logger.info(`Fetched user games data: ${JSON.stringify(games)}`);

    if (games) {
      games.forEach((game) => {
        if (game.createdAt) game.createdAt = game.createdAt.toISOString();
        if (game.updatedAt) game.updatedAt = game.updatedAt.toISOString();
        if (game.playableAt) game.playableAt = game.playableAt.toISOString();
      });
      return games;
    }

    throw new HttpsError(
      'not-found',
      'failed to find the games with given criteria',
    );
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});
