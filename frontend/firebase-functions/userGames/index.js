const { region, https } = require('firebase-functions');
const { defineString } = require('firebase-functions/params');

const dataApiUrl = defineString('DATA_API_URL');
const dataApiKey = defineString('DATA_API_KEY');
const dataSource = defineString('DATA_SOURCE');
const dbName = defineString('DB_NAME');

const makeApiCall = async (action, data, collection) => {
  const body = {
    dataSource: dataSource.value(),
    database: dbName.value(),
    collection: collection || 'userGames',
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

exports.get = region('asia-south1').https.onCall(async (data, context) => {
  const userId = context.auth?.uid;
  if (userId) {
    const gameDoc = await makeApiCall('/action/findOne', {
      filter: {
        owner_id: userId,
        gameNo: data.gameNo,
      },
    });

    console.info(`Fetched user game data: ${JSON.stringify(gameDoc)}`);

    if (gameDoc && typeof gameDoc !== 'string') {
      return gameDoc.document;
    }

    throw new https.HttpsError(
      'not-found',
      gameDoc || 'failed to find the game with given no'
    );
  }

  throw new https.HttpsError('unauthenticated', 'No user id provided');
});

exports.getRange = region('asia-south1').https.onCall(async (data, context) => {
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

    console.info(`Fetched user games data: ${JSON.stringify(gameDocs)}`);

    if (gameDocs && typeof gameDocs !== 'string') {
      return gameDocs.documents;
    }

    throw new https.HttpsError(
      'not-found',
      gameDocs || 'failed to find the user games with given criteria'
    );
  }

  throw new https.HttpsError('unauthenticated', 'No user id provided');
});

exports.update = region('asia-south1').https.onCall(async (data, context) => {
  const startTime = Date.now();
  console.debug('Incoming data', data, 'context', context);
  const userId = context.auth?.uid;
  if (userId) {
    const retVal = {};
    const updatePromises = [];
    const getPromises = [];

    if (data.userChanges && (data.userChanges.$set || data.userChanges.$inc)) {
      const userUpdate = {
        ...data.userChanges,
      };

      if (!userUpdate.$set) {
        userUpdate.$set = {};
      }

      userUpdate.$set.updatedAt = {
        $date: { $numberLong: `${Date.now()}` },
      };

      updatePromises.push(
        makeApiCall(
          '/action/updateOne',
          {
            filter: {
              _id: userId,
            },
            update: userUpdate,
          },
          'users'
        )
      );

      // const userUpdateRes = await ;

      // functions.logger.info(
      //   `Updated user data: ${JSON.stringify(userUpdateRes)}`
      // );

      // if (userUpdateRes && typeof userUpdateRes !== 'string') {
      //   const userDoc = await makeApiCall(
      //     '/action/findOne',
      //     {
      //       filter: {
      //         _id: userId,
      //       },
      //     },
      //     'users'
      //   );

      //   functions.logger.info(`Got user data: ${JSON.stringify(userDoc)}`);
      //   if (userDoc && typeof userDoc !== 'string') {
      //     retVal.user = userDoc.document;
      //   }
      // }
    }

    const update = {
      ...data.userGameChanges,
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
          $numberLong: `${new Date(update.$push.attempts.playedAt).getTime()}`,
        },
      };
    }

    updatePromises.push(
      makeApiCall('/action/updateOne', {
        filter: {
          owner_id: userId,
          gameNo: data.gameNo,
        },
        update,
        upsert: true,
      })
    );

    const updateRes = await Promise.allSettled(updatePromises);
    const startTime1 = Date.now();
    console.log(
      `updated the user & userGame entries in ${
        startTime1 - startTime
      }ms: ${JSON.stringify(updateRes)}`
    );

    getPromises.push(
      makeApiCall(
        '/action/findOne',
        {
          filter: {
            _id: userId,
          },
        },
        'users'
      ),
      makeApiCall('/action/findOne', {
        filter: {
          owner_id: userId,
          gameNo: data.gameNo,
        },
      })
    );

    const getRes = await Promise.allSettled(getPromises);
    console.log(`get request fulfilled in ${Date.now() - startTime1}ms`);
    console.log(`Got user data res: ${JSON.stringify(getRes[0])}`);
    console.log(`Got user game res: ${JSON.stringify(getRes[1])}`);

    if (
      getRes[0].status === 'fulfilled' &&
      typeof getRes[0].value !== 'string'
    ) {
      retVal.user = getRes[0].value.document;
    }

    if (
      getRes[1].status === 'fulfilled' &&
      typeof getRes[1].value !== 'string'
    ) {
      retVal.userGame = getRes[1].value.document;
      return retVal;
    }

    throw new https.HttpsError(
      'not-found',
      updateRes || 'failed to find the user with given id'
    );
  }

  throw new https.HttpsError('unauthenticated', 'No user id provided');
});
