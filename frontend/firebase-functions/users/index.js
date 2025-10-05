const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { fireStore } = require('../common/init');
const { connectToDatabase } = require('../common/mongo');

exports.create = onCall(async (request) => {
  const userId = request.auth?.uid;
  logger.log(`incoming userId: ${userId} in users-create`);
  if (userId) {
    const time = new Date();
    const user = {
      _id: userId,
      createdAt: time,
      updatedAt: time,
      data: {
        currStreak: 0,
        longestStreak: 0,
        isCurrLongestStreak: false,
        solves: 0,
        played: 0,
      },
    };

    const { db } = await connectToDatabase();
    const result = await db.collection('users').insertOne(user);

    logger.info(`Inserted the new user: ${JSON.stringify(result)}`);

    if (result.insertedId) {
      if (user.createdAt) user.createdAt = user.createdAt.toISOString();
      if (user.updatedAt) user.updatedAt = user.updatedAt.toISOString();
      return user;
    }

    throw new HttpsError(
      'unknown',
      'failed to create new user in the database',
    );
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});

exports.get = onCall(async (request) => {
  const userId = request.auth?.uid;
  logger.log(`incoming userId: ${userId}`);
  if (userId) {
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: userId });

    if (user) {
      if (user.createdAt) user.createdAt = user.createdAt.toISOString();
      if (user.updatedAt) user.updatedAt = user.updatedAt.toISOString();
      return user;
    }

    throw new HttpsError('not-found', 'failed to find the user with given id');
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});

exports.update = onCall(async (request) => {
  logger.debug('Incoming data', request.data, 'context', request.context);
  const userId = request.auth?.uid;
  if (userId && request.data) {
    const update = {
      ...request.data,
    };

    if (!update.$set) {
      update.$set = {};
    }

    update.$set.updatedAt = new Date();

    const { db } = await connectToDatabase();
    const updateRes = await db
      .collection('users')
      .updateOne({ _id: userId }, update);

    logger.info(`Updated user data: ${JSON.stringify(updateRes)}`);

    if (updateRes.modifiedCount > 0 || updateRes.matchedCount > 0) {
      const user = await db.collection('users').findOne({ _id: userId });
      logger.info(`Got user data: ${JSON.stringify(user)}`);
      if (user) {
        if (user.createdAt) user.createdAt = user.createdAt.toISOString();
        if (user.updatedAt) user.updatedAt = user.updatedAt.toISOString();
        return user;
      }
    }

    throw new HttpsError('not-found', 'failed to find the user with given id');
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});

exports.migrate = onCall(async (request) => {
  const callingId = request.auth?.uid;
  logger.log(
    `incoming migrate request: callingId: ${callingId}: ${JSON.stringify(
      request.data,
      null,
      2,
    )}`,
  );

  const data = request.data;
  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  const getUserData = async (id) => {
    const user = await usersCollection.findOne({ _id: id });
    logger.log(`returned user resp: ${JSON.stringify(user)}`);
    if (user) {
      return user;
    }
    throw new HttpsError('not-found', 'failed to find the user with given id');
  };

  if (callingId && data) {
    const realmUserId = data.realmUserId;
    const firebaseUserId = data.firebaseUserId;
    if (realmUserId) {
      const userData = await getUserData(realmUserId);
      if (userData) {
        const date = new Date();
        const newDoc = {
          _id: callingId,
          realm_id: realmUserId,
          data: userData.data,
          createdAt: userData.createdAt,
          updatedAt: date,
        };

        const createUserResp = await usersCollection.insertOne(newDoc);

        if (createUserResp.insertedId) {
          logger.log(`createUserResp: ${JSON.stringify(createUserResp)}`);

          const job = await fireStore.collection('migrations').add({
            type: 'realm',
            db: 'mongo',
            oldUserId: realmUserId,
            newUserId: callingId,
          });

          logger.log(`create new doc in firestore: ${job.id}`);

          return {
            status: 'Queued!',
            user: {
              ...newDoc,
              createdAt: newDoc.createdAt.toISOString(),
              updatedAt: newDoc.updatedAt.toISOString(),
            },
          };
        }

        throw new HttpsError('unknown', 'Failed to create the user document');
      }
    } else if (firebaseUserId) {
      const job = await fireStore.collection('migrations').add({
        type: 'firebase',
        db: 'mongo',
        oldUserId: firebaseUserId,
        newUserId: callingId,
      });

      logger.log(`create new doc in firestore: ${job.id}`);

      return { status: 'Queued!' };
    }
  }

  throw new HttpsError('unauthenticated', 'No user id provided');
});
