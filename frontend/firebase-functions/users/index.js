const functions = require('firebase-functions');
const { getApp, getApps, initializeApp } = require('firebase-admin/app');
const { initializeFirestore } = require('firebase-admin/firestore');
const { defineString } = require('firebase-functions/params');

const dataApiUrl = defineString('DATA_API_URL');
const dataApiKey = defineString('DATA_API_KEY');
const dataSource = defineString('DATA_SOURCE');
const dbName = defineString('DB_NAME');

const app = !getApps().length ? initializeApp() : getApp();
const fireStore = initializeFirestore(app, { preferRest: true });

const makeApiCall = async (action, data) => {
  const body = {
    dataSource: dataSource.value(),
    database: dbName.value(),
    collection: 'users',
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

exports.create = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
      const time = Date.now();
      const user = {
        _id: userId,
        createdAt: {
          $date: { $numberLong: `${time}` },
        },
        updatedAt: {
          $date: { $numberLong: `${time}` },
        },
        data: {
          currStreak: 0,
          longestStreak: 0,
          isCurrLongestStreak: false,
          solves: 0,
          played: 0,
        },
      };

      const insertedDoc = await makeApiCall('/action/insertOne', {
        document: user,
      });

      functions.logger.info(
        `Inserted the new user: ${JSON.stringify(insertedDoc)}`
      );

      if (insertedDoc && typeof insertedDoc !== 'string') {
        const dateString = new Date().toISOString();
        return { ...user, createdAt: dateString, updatedAt: dateString };
      }

      throw new functions.https.HttpsError(
        'not-found',
        insertedDoc || 'failed to create new user in the database'
      );
    }

    throw new functions.https.HttpsError(
      'unauthenticated',
      'No user id provided'
    );
  });

exports.get = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
      const userDoc = await makeApiCall('/action/findOne', {
        filter: {
          _id: userId,
        },
      });

      functions.logger.info(`Fetched user data: ${JSON.stringify(userDoc)}`);

      if (userDoc && typeof userDoc !== 'string') {
        return userDoc.document;
      }

      throw new functions.https.HttpsError(
        'not-found',
        userDoc || 'failed to find the user with given id'
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
        ...data,
      };

      if (!update.$set) {
        update.$set = {};
      }

      update.$set.updatedAt = {
        $date: { $numberLong: `${Date.now()}` },
      };

      const updateRes = await makeApiCall('/action/updateOne', {
        filter: {
          _id: userId,
        },
        update,
      });

      functions.logger.info(`Updated user data: ${JSON.stringify(updateRes)}`);

      if (updateRes && typeof userDoc !== 'string') {
        const userDoc = await makeApiCall('/action/findOne', {
          filter: {
            _id: userId,
          },
        });

        functions.logger.info(`Got user data: ${JSON.stringify(userDoc)}`);
        if (userDoc && typeof userDoc !== 'string') {
          return userDoc.document;
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

exports.migrate = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const callingId = context.auth?.uid;
    console.log(
      `incoming migrate request: callingId: ${callingId}: ${JSON.stringify(
        data,
        null,
        2
      )}`
    );

    const getUserData = async (id) => {
      const userDoc = await makeApiCall('/action/findOne', {
        filter: {
          _id: id,
        },
      });

      console.log(`returned user resp: ${JSON.stringify(userDoc)}`);
      if (userDoc && typeof userDoc !== 'string') {
        return userDoc.document;
      }

      throw new functions.https.HttpsError(
        'not-found',
        userDoc || 'failed to find the user with given id'
      );
    };

    if (callingId) {
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
            createdAt: {
              $date: {
                $numberLong: `${new Date(userData.createdAt).getTime()}`,
              },
            },
            updatedAt: { $date: { $numberLong: `${date.getTime()}` } },
          };

          const createUserResp = await makeApiCall('/action/insertOne', {
            document: newDoc,
          });

          if (createUserResp && typeof createUserResp !== 'string') {
            console.log(`createUserResp: ${JSON.stringify(createUserResp)}`);

            const job = await fireStore.collection('migrations').add({
              type: 'realm',
              db: 'mongo',
              oldUserId: realmUserId,
              newUserId: callingId,
            });

            console.log(`create new doc in firestore: ${job.id}`);

            return {
              status: 'Queued!',
              user: {
                _id: callingId,
                realm_id: realmUserId,
                data: userData.data,
                createdAt: userData.createdAt,
                updatedAt: date.toISOString(),
              },
            };
          }

          throw new functions.https.HttpsError(
            'unknown',
            createUserResp || 'Failed to create the user document'
          );
        }
      } else if (firebaseUserId) {
        const job = await fireStore.collection('migrations').add({
          type: 'firebase',
          db: 'mongo',
          oldUserId: firebaseUserId,
          newUserId: callingId,
        });

        console.log(`create new doc in firestore: ${job.id}`);

        return { status: 'Queued!' };
      }
    }

    throw new functions.https.HttpsError(
      'unauthenticated',
      'No user id provided'
    );
  });
