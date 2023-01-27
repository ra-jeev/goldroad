exports = async function (changeEvent) {
  console.log('changeEvent.documentKey._id', changeEvent.documentKey._id);
  console.log('changeEvent: ', JSON.stringify(changeEvent));
  const updatedFields = changeEvent.updateDescription?.updatedFields;
  const { serviceName, dbName } = context.environment.values;

  console.log(`serviceName: ${serviceName}, dbName: ${dbName}`);

  const mongoDb = context.services.get(serviceName).db(dbName);
  const gamesCollection = mongoDb.collection('games');

  if (updatedFields) {
    let filter;
    let incChanges;

    console.log('updatedFields:', JSON.stringify(updatedFields));
    if (updatedFields['data.lastGamePlayed']) {
      const lastGamePlayed = updatedFields['data.lastGamePlayed'];
      filter = { _id: BSON.ObjectId(lastGamePlayed._id) };
      incChanges = {
        ['stats.played']: 1,
      };

      if (lastGamePlayed.solved) {
        incChanges['stats.solved'] = 1;
        incChanges[`stats.tries.${lastGamePlayed.tries}`] = 1;
      }
    } else if (updatedFields['data.currStreak']) {
      filter = {
        _id: BSON.ObjectId(updatedFields['data.lastGamePlayed.gameId']),
      };
      const tries = updatedFields['data.lastGamePlayed.tries'];
      incChanges = {
        ['stats.solved']: 1,
        [`stats.tries.${tries}`]: 1,
      };
    }

    if (filter) {
      console.log(`update filter: ${JSON.stringify(filter)}`);
      console.log(`incChanges: ${JSON.stringify(incChanges)}`);
      const result = await gamesCollection.updateOne(filter, {
        $inc: incChanges,
        $set: { updatedAt: new Date() },
      });

      console.log('result of update operation: ', JSON.stringify(result));
    }
  }
};
