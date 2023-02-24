const functions = require('firebase-functions');
const { getApps, initializeApp, getApp } = require('firebase-admin/app');
const { initializeFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const { defineString } = require('firebase-functions/params');

const accessControlOrigin = defineString('ACCESS_CONTROL_ORIGIN');

const app = !getApps().length ? initializeApp() : getApp();
const fireStore = initializeFirestore(app, { preferRest: true });
const messaging = getMessaging();

const TOPIC_NAME = 'newPuzzle';

exports.registerToken = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    const token = data.token;

    if (!token) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'No registration token passed'
      );
    }

    try {
      await messaging.subscribeToTopic(token, TOPIC_NAME);

      await fireStore.collection('tokens').doc(userId).set({
        id: userId,
        token,
      });

      return {
        status: 'OK',
      };
    } catch (error) {
      console.log(
        `failed to register the token for ${userId} to the topic`,
        error
      );
    }
  });

exports.newGameAvailable = functions
  .region('asia-south1')
  .https.onRequest(async (request, response) => {
    console.log(
      'Entered sendNewGameMessage with req.body:',
      JSON.stringify(request.body)
    );
    if (request.method !== 'POST') {
      return response
        .status(400)
        .send('Bad request, this endpoint only accepts POST requests');
    }

    const data = request.body;
    if (!data.gameNo) {
      return response.status(400).send('Bad request, no game number provided');
    }

    const url = accessControlOrigin.value().includes('dev.playgoldroad.com')
      ? 'https://dev.playgoldroad.com'
      : 'https://playgoldroad.com';
    const iconSuffix = '/icon-192.png';

    const newGameNo = data.gameNo;
    console.log(`the game no to message: ${newGameNo}`);
    const messageId = await messaging.send({
      notification: {
        title: `GoldRoad #${newGameNo} is live`,
        body: 'Get your walking boots on!',
      },
      webpush: {
        headers: { TTL: '86400' },
        notification: {
          icon: `${url}${iconSuffix}`,
          renotify: true,
          tag: TOPIC_NAME,
        },
        fcm_options: {
          link: url,
        },
      },
      topic: TOPIC_NAME,
    });

    console.log(`messaged sent to the topic with message id: ${messageId}`);

    const resp = await fetch(url + '/api/games');
    if (!resp.ok) {
      const text = await resp.text();
      console.log(`API call failed with: ${resp.statusText}, text:`, text);
      return text || resp.statusText;
    } else {
      const game = await resp.json();
      console.log(`got the game: ${game.gameNo}, maxScore: ${game.maxScore}`);
    }

    response.status(200).send('Done');
  });
