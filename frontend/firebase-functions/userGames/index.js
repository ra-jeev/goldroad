const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../common/mongo');

exports.get = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (userId) {
    const { db } = await connectToDatabase();
    const game = await db.collection('userGames').findOne({
      owner_id: userId,
      gameNo: request.data.gameNo,
    });

    logger.info(`Fetched user game data: ${JSON.stringify(game)}`);

    if (game) {
      if (game.createdAt) game.createdAt = game.createdAt.toISOString();
      if (game.updatedAt) game.updatedAt = game.updatedAt.toISOString();
      if (game.attempts && game.attempts.length) {
        game.attempts.forEach((a) => {
          if (a.playedAt) a.playedAt = a.playedAt.toISOString();
        });
      }
      return game;
    }

    throw new HttpsError('not-found', 'failed to find the game with given no');
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});

exports.getRange = onCall(async (request) => {
  const userId = request.auth?.uid;
  const data = request.data;
  if (userId && data) {
    const { db } = await connectToDatabase();
    const games = await db
      .collection('userGames')
      .find({
        owner_id: userId,
        gameNo: {
          $lte: data.gameNo.startAt,
          $gte: data.gameNo.endAt,
        },
      })
      .sort({ gameNo: -1 })
      .toArray();

    logger.info(`Fetched user games data: ${JSON.stringify(games)}`);

    if (games) {
      games.forEach((game) => {
        if (game.createdAt) game.createdAt = game.createdAt.toISOString();
        if (game.updatedAt) game.updatedAt = game.updatedAt.toISOString();
      });
      return games;
    }

    throw new HttpsError(
      'not-found',
      'failed to find the user games with given criteria',
    );
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});

exports.update = onCall(async (request) => {
  const startTime = Date.now();
  logger.debug('Incoming data', request.data);
  const userId = request.auth?.uid;
  const data = request.data;
  if (userId) {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const userGamesCollection = db.collection('userGames');
    const gamesCollection = db.collection('games');

    const retVal = {};
    const updatePromises = [];

    if (data.userChanges && (data.userChanges.$set || data.userChanges.$inc)) {
      const userUpdate = {
        ...data.userChanges,
      };

      if (!userUpdate.$set) {
        userUpdate.$set = {};
      }

      userUpdate.$set.updatedAt = new Date();

      updatePromises.push(
        usersCollection.updateOne({ _id: userId }, userUpdate),
      );

      // Logic from onGameSolved.js
      const lastGamePlayed = userUpdate.$set['data.lastGamePlayed'];
      const lastGamePlayedSolved =
        userUpdate.$set['data.lastGamePlayed.solved'];

      if (lastGamePlayed) {
        const incChanges = { 'stats.played': 1 };
        if (lastGamePlayed.solved) {
          incChanges['stats.solved'] = 1;
          incChanges[`stats.tries.${lastGamePlayed.tries}`] = 1;
        }

        updatePromises.push(
          gamesCollection.updateOne(
            { _id: new ObjectId(lastGamePlayed._id) },
            { $inc: incChanges, $set: { updatedAt: new Date() } },
          ),
        );
      } else if (lastGamePlayedSolved) {
        logger.log('lastGamePlayedSolved in multiple tries: ');
        const tries = userUpdate.$set['data.lastGamePlayed.tries'];
        const gameId = userUpdate.$set['data.lastGamePlayed.gameId'];

        if (tries && gameId) {
          const incChanges = {
            'stats.solved': 1,
            [`stats.tries.${tries}`]: 1,
          };
          updatePromises.push(
            gamesCollection.updateOne(
              { _id: new ObjectId(gameId) },
              { $inc: incChanges, $set: { updatedAt: new Date() } },
            ),
          );
        }
      }
    }

    const update = {
      ...data.userGameChanges,
    };

    if (update.$set) {
      if (update.$set.createdAt) {
        update.$set.createdAt = new Date(update.$set.createdAt);
      }

      if (update.$set.updatedAt) {
        update.$set.updatedAt = new Date(update.$set.updatedAt);
      }

      if (update.$set.attempts) {
        update.$set.attempts.forEach((attempt) => {
          attempt.playedAt = new Date(attempt.playedAt);
        });
      }
    }

    if (update.$push) {
      update.$push.attempts.playedAt = new Date(update.$push.attempts.playedAt);
    }

    updatePromises.push(
      userGamesCollection.updateOne(
        {
          owner_id: userId,
          gameNo: data.gameNo,
        },
        update,
        { upsert: true },
      ),
    );

    const updateRes = await Promise.allSettled(updatePromises);
    const startTime1 = Date.now();
    logger.log(
      `updated the user & userGame entries in ${
        startTime1 - startTime
      }ms: ${JSON.stringify(updateRes)}`,
    );

    const getPromises = [
      usersCollection.findOne({ _id: userId }),
      userGamesCollection.findOne({ owner_id: userId, gameNo: data.gameNo }),
    ];

    const getRes = await Promise.allSettled(getPromises);
    logger.log(`get request fulfilled in ${Date.now() - startTime1}ms`);
    logger.log(`Got user data res: ${JSON.stringify(getRes[0])}`);
    logger.log(`Got user game res: ${JSON.stringify(getRes[1])}`);

    if (getRes[0].status === 'fulfilled' && getRes[0].value) {
      const user = getRes[0].value;
      if (user.createdAt) user.createdAt = user.createdAt.toISOString();
      if (user.updatedAt) user.updatedAt = user.updatedAt.toISOString();
      retVal.user = user;
    }

    if (getRes[1].status === 'fulfilled' && getRes[1].value) {
      const userGame = getRes[1].value;
      if (userGame.createdAt)
        userGame.createdAt = userGame.createdAt.toISOString();
      if (userGame.updatedAt)
        userGame.updatedAt = userGame.updatedAt.toISOString();
      if (userGame.attempts && userGame.attempts.length) {
        userGame.attempts.forEach((a) => {
          if (a.playedAt) a.playedAt = a.playedAt.toISOString();
        });
      }
      retVal.userGame = userGame;
    }

    if (retVal.user || retVal.userGame) {
      return retVal;
    }

    throw new HttpsError('not-found', 'failed to find the user with given id');
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});
