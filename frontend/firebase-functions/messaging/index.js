const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { getMessaging } = require('firebase-admin/messaging');
const { fireStore } = require('../common/init');

const messaging = getMessaging();
const TOPIC_NAME = 'newPuzzle';

exports.registerToken = onCall(async (request) => {
  const userId = request.auth?.uid;
  const token = request.data.token;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'No user id provided');
  }

  if (!token) {
    throw new HttpsError('invalid-argument', 'No registration token passed');
  }

  try {
    await messaging.subscribeToTopic(token, TOPIC_NAME);
    logger.info(`Subscribed token ${token} to topic ${TOPIC_NAME}`);

    await fireStore.collection('tokens').doc(userId).set({
      id: userId,
      token,
    });
    logger.info(`Saved token for user ${userId}`);

    return { status: 'OK' };
  } catch (error) {
    logger.error(
      `Failed to register the token for ${userId} to the topic`,
      error,
    );
    throw new HttpsError('internal', 'Failed to subscribe or save token.');
  }
});
