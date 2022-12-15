exports = async function (authEvent) {
  const { user, time } = authEvent;

  console.log(`context.environment: ${JSON.stringify(context.environment)}`);

  const { serviceName, dbName } = context.environment.values;

  const mongoDb = context.services.get(serviceName).db(dbName);
  const usersCollection = mongoDb.collection('users');
  const userData = { _id: user.id, ...user, createdAt: time, updatedAt: time };
  userData.data = {
    currStreak: 0,
    longestStreak: 0,
    isCurrLongestStreak: false,
    solves: 0,
    played: 0,
  };

  delete userData.id;
  const res = await usersCollection.insertOne(userData);
  console.log('result of user insert op: ', JSON.stringify(res));
};
