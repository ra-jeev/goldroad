const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');
const { createHmac } = require('crypto');
const cors = require('cors');

const endpointUrl = defineString('ENDPOINT_URL');
const endpointSecret = defineString('ENDPOINT_SECRET');
const accessControlOrigin = defineString('ACCESS_CONTROL_ORIGIN');

const getDataUsingHTTPSEndpoint = async (gameNo) => {
  const hmac = createHmac('sha256', endpointSecret.value());
  let url = endpointUrl.value();
  if (gameNo) {
    hmac.update(`num=${gameNo}`);
    url = url + `?num=${gameNo}`;
  }

  const hash = hmac.digest('hex');
  const fetchResp = await fetch(url, {
    headers: {
      'Endpoint-Signature': `sha256=${hash}`,
    },
  });

  return await fetchResp.json();
};

exports.getRequestedGame = functions
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
        const data = await getDataUsingHTTPSEndpoint(request.query.num);
        functions.logger.info('got game data: ', JSON.stringify(data));

        if (data.status === 'OK') {
          let cacheTime = 300; // 5 mins local cache time
          let serverCacheTime = 3600;
          if (data.game.nextGameAt && !request.query.num) {
            console.log(
              `data.game.nextGameAt: ${
                data.game.nextGameAt
              }, typeof: ${typeof data.game.nextGameAt}`
            );

            const nextGameAtInMs = new Date(data.game.nextGameAt).getTime();
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

          response.status(200).send(data.game);
        } else {
          response
            .status(404)
            .send("Couldn't find the requested game. Please try again later.");
        }
      }
    );
  });
