const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');

const dataApiUrl = defineString('DATA_API_URL');
const dataApiKey = defineString('DATA_API_KEY');
const dataSource = defineString('DATA_SOURCE');
const dbName = defineString('DB_NAME');

const makeApiCall = async (action, data) => {
  const body = {
    dataSource: dataSource.value(),
    database: dbName.value(),
    collection: 'userGames',
    ...data,
  };

  const resp = await fetch(dataApiUrl.value() + action, {
    method: 'POST',
    headers: {
      'api-key': dataApiKey.value(),
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.log(`API call failed with: ${resp.statusText}, text:`, text);
    return text || resp.statusText;
  }

  return await resp.json();
};

exports.get = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
      const gameDoc = await makeApiCall('/action/findOne', {
        filter: {
          owner_id: userId,
          gameNo: data.gameNo,
        },
      });

      functions.logger.info(
        `Fetched user game data: ${JSON.stringify(gameDoc)}`
      );

      if (gameDoc && typeof gameDoc !== 'string') {
        return gameDoc.document;
      }

      throw new functions.https.HttpsError(
        'not-found',
        gameDoc || 'failed to find the game with given no'
      );
    }

    throw new functions.https.HttpsError(
      'unauthenticated',
      'No user id provided'
    );
  });

exports.getRange = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
      const gameDocs = await makeApiCall('/action/find', {
        filter: {
          owner_id: userId,
          gameNo: {
            $lte: data.gameNo.startAt,
            $gte: data.gameNo.endAt,
          },
        },
        sort: {
          gameNo: -1,
        },
      });

      functions.logger.info(
        `Fetched user games data: ${JSON.stringify(gameDocs)}`
      );

      if (gameDocs && typeof gameDocs !== 'string') {
        return gameDocs.documents;
      }

      throw new functions.https.HttpsError(
        'not-found',
        gameDocs || 'failed to find the user games with given criteria'
      );
    }

    throw new functions.https.HttpsError(
      'unauthenticated',
      'No user id provided'
    );
  });

exports.update = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    functions.logger.debug('Incoming data', data, 'context', context);
    const userId = context.auth?.uid;
    if (userId) {
      const update = {
        ...data.changes,
      };

      if (update.$set) {
        if (update.$set.createdAt) {
          update.$set.createdAt = {
            $date: {
              $numberLong: `${new Date(update.$set.createdAt).getTime()}`,
            },
          };
        }

        if (update.$set.updatedAt) {
          update.$set.updatedAt = {
            $date: {
              $numberLong: `${new Date(update.$set.updatedAt).getTime()}`,
            },
          };
        }

        if (update.$set.attempts) {
          update.$set.attempts.forEach((attempt) => {
            attempt.playedAt = {
              $date: { $numberLong: `${new Date(attempt.playedAt).getTime()}` },
            };
          });
        }
      }

      if (update.$push) {
        update.$push.attempts.playedAt = {
          $date: {
            $numberLong: `${new Date(
              update.$push.attempts.playedAt
            ).getTime()}`,
          },
        };
      }

      const updateRes = await makeApiCall('/action/updateOne', {
        filter: {
          owner_id: userId,
          gameNo: data.gameNo,
        },
        update,
        upsert: true,
      });

      functions.logger.info(
        `Updated user game data: ${JSON.stringify(updateRes)}`
      );

      if (updateRes && typeof userDoc !== 'string') {
        const userGameDoc = await makeApiCall('/action/findOne', {
          filter: {
            owner_id: userId,
            gameNo: data.gameNo,
          },
        });

        functions.logger.info(
          `Got user game data: ${JSON.stringify(userGameDoc)}`
        );

        if (userGameDoc && typeof userGameDoc !== 'string') {
          return userGameDoc.document;
        }
      }

      throw new functions.https.HttpsError(
        'not-found',
        updateRes || 'failed to find the user with given id'
      );
    }

    throw new functions.https.HttpsError(
      'unauthenticated',
      'No user id provided'
    );
  });
