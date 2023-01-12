exports = async function (changeEvent) {
  /*
    A Database Trigger will always call a function with a changeEvent.
    Documentation on ChangeEvents: https://www.mongodb.com/docs/manual/reference/change-events

    Access the _id of the changed document:
    const docId = changeEvent.documentKey._id;

    Access the latest version of the changed document
    (with Full Document enabled for Insert, Update, and Replace operations):
    const fullDocument = changeEvent.fullDocument;

    const updateDescription = changeEvent.updateDescription;

    See which fields were changed (if any):
    if (updateDescription) {
      const updatedFields = updateDescription.updatedFields; // A document containing updated fields
    }

    See which fields were removed (if any):
    if (updateDescription) {
      const removedFields = updateDescription.removedFields; // An array of removed fields
    }

    Functions run by Triggers are run as System users and have full access to Services, Functions, and MongoDB Data.

    Access a mongodb service:
    const collection = context.services.get("gcp-goldroad").db("goldroadDb-dev").collection("users");
    const doc = collection.findOne({ name: "mongodb" });

    Note: In Atlas Triggers, the service name is defaulted to the cluster name.

    Call other named functions if they are defined in your application:
    const result = context.functions.execute("function_name", arg1, arg2);

    Access the default http client and execute a GET request:
    const response = context.http.get({ url: <URL> })

    Learn more about http client here: https://www.mongodb.com/docs/atlas/app-services/functions/context/#context-http
  */
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
