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
