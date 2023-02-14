const functions = require('firebase-functions');
const cors = require('cors');
const { defineString } = require('firebase-functions/params');

const accessControlOrigin = defineString('ACCESS_CONTROL_ORIGIN');
const dataApiUrl = defineString('DATA_API_URL');
const dataApiKey = defineString('DATA_API_KEY');
const dataSource = defineString('DATA_SOURCE');
const dbName = defineString('DB_NAME');

const makeApiCall = async (action, data) => {
  const body = {
    dataSource: dataSource.value(),
    database: dbName.value(),
    collection: 'games',
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
  .https.onRequest((request, response) => {
    functions.logger.info('getRequestedGame: Entered...!');

    if (request.method !== 'GET') {
      return response
        .status(400)
        .send('Bad request, this endpoint only accepts GET requests');
    }

    cors({ origin: accessControlOrigin.value().split(',') })(
      request,
      response,
      async () => {
        console.log('request.query:', request.query);
        const filter = request.query.num
          ? {
              active: true,
              gameNo: parseInt(request.query.num),
            }
          : { current: true };

        const gameDoc = await makeApiCall('/action/findOne', {
          filter,
        });

        if (gameDoc && typeof gameDoc !== 'string') {
          const game = gameDoc.document;
          let cacheTime = 300; // 5 mins local cache time
          let serverCacheTime = 3600;
          if (game.nextGameAt && !request.query.num) {
            const nextGameAtInMs = new Date(game.nextGameAt).getTime();
            console.log(
              `nextGameAtInMs: ${nextGameAtInMs}, gapInMins: ${
                (nextGameAtInMs - Date.now()) / 60000
              }`
            );

            // Server Cache time, minus the local cache time
            serverCacheTime =
              parseInt((nextGameAtInMs - Date.now()) / 1000) - cacheTime;
            if (serverCacheTime < 0) {
              serverCacheTime = 0;
            }

            if (serverCacheTime < cacheTime) {
              cacheTime = serverCacheTime;
            }
          }

          console.log(
            `cacheTime: ${cacheTime}, serverCacheTime: ${serverCacheTime}`
          );

          response.set(
            'Cache-Control',
            `public, max-age=${cacheTime}, s-maxage=${serverCacheTime}`
          );

          delete game.hints;
          delete game.maxScoreMoves;
          response.status(200).send(game);
        } else {
          response
            .status(404)
            .send("Couldn't find the requested game. Please try again later.");
        }
      }
    );
  });

exports.getRange = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
      const filter = {
        active: true,
        current: false,
      };

      if (data.gameNo?.startAt) {
        filter.gameNo = {
          $lte: data.gameNo.startAt,
        };
      }

      const gameDocs = await makeApiCall('/action/find', {
        filter,
        sort: {
          gameNo: -1,
        },
        projection: {
          gameNo: 1,
          maxScore: 1,
        },
        limit: data.limit || 15,
      });

      functions.logger.info(
        `Fetched user games data: ${JSON.stringify(gameDocs)}`
      );

      if (gameDocs && typeof gameDocs !== 'string') {
        return gameDocs.documents;
      }

      throw new functions.https.HttpsError(
        'not-found',
        gameDocs || 'failed to find the games with given criteria'
      );
    }

    throw new functions.https.HttpsError(
      'unauthenticated',
      'No user id provided'
    );
  });
