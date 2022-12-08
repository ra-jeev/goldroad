exports = async function (authEvent) {
  const { user, time } = authEvent;

  const mongoDb = context.services.get('gcp-goldroad').db('goldroadDb');
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
