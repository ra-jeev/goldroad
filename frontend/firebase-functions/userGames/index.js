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

    return null;
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
  logger.debug('Incoming data', request.data);
  const userId = request.auth?.uid;
  const data = request.data;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'No user id provided');
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');
  const userGamesCollection = db.collection('userGames');
  const gamesCollection = db.collection('games');

  let updatedUser = null;

  if (data.userChanges && (data.userChanges.$set || data.userChanges.$inc)) {
    const userUpdate = { ...data.userChanges };
    if (!userUpdate.$set) {
      userUpdate.$set = {};
    }
    userUpdate.$set.updatedAt = new Date();

    const userResult = await usersCollection.findOneAndUpdate(
      { _id: userId },
      userUpdate,
      { upsert: true, returnDocument: 'after' }, // Use upsert: true
    );

    // If the update was requested but failed to find or create a user, halt execution.
    if (!userResult) {
      throw new HttpsError(
        'not-found',
        'Failed to find or update the specified user.',
      );
    }
    updatedUser = userResult;
  }

  const parallelPromises = [];
  if (data.userGameChanges) {
    const userGameUpdate = { ...data.userGameChanges };
    if (userGameUpdate.$set) {
      if (userGameUpdate.$set.createdAt)
        userGameUpdate.$set.createdAt = new Date(userGameUpdate.$set.createdAt);
      if (userGameUpdate.$set.updatedAt)
        userGameUpdate.$set.updatedAt = new Date(userGameUpdate.$set.updatedAt);
      if (userGameUpdate.$set.attempts) {
        userGameUpdate.$set.attempts.forEach((a) => {
          if (a.playedAt) a.playedAt = new Date(a.playedAt);
        });
      }
    }

    if (userGameUpdate.$push) {
      userGameUpdate.$push.attempts.playedAt = new Date(
        userGameUpdate.$push.attempts.playedAt,
      );
    }

    parallelPromises.push(
      userGamesCollection.findOneAndUpdate(
        { owner_id: userId, gameNo: data.gameNo },
        userGameUpdate,
        { upsert: true, returnDocument: 'after' },
      ),
    );
  }

  if (updatedUser) {
    const lastGamePlayed = updatedUser.data.lastGamePlayed;
    if (lastGamePlayed) {
      const incChanges = { 'stats.played': 1 };
      if (lastGamePlayed.solved) {
        incChanges['stats.solved'] = 1;
        incChanges[`stats.tries.${lastGamePlayed.tries}`] = 1;
      }

      parallelPromises.push(
        gamesCollection.updateOne(
          { _id: new ObjectId(lastGamePlayed._id) },
          { $inc: incChanges, $set: { updatedAt: new Date() } },
        ),
      );
    }
  }

  const retVal = {};
  if (parallelPromises.length > 0) {
    const [userGameResult] = await Promise.all(parallelPromises);
    if (userGameResult) {
      const userGame = userGameResult;
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
  }

  if (updatedUser) {
    if (updatedUser.createdAt)
      updatedUser.createdAt = updatedUser.createdAt.toISOString();
    if (updatedUser.updatedAt)
      updatedUser.updatedAt = updatedUser.updatedAt.toISOString();
    retVal.user = updatedUser;
  } else if (!retVal.userGame) {
    const user = await usersCollection.findOne({ _id: userId });
    if (user) {
      if (user.createdAt) user.createdAt = user.createdAt.toISOString();
      if (user.updatedAt) user.updatedAt = user.updatedAt.toISOString();
      retVal.user = user;
    }
  }

  return retVal;
});
