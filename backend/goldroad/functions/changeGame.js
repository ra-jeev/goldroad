exports = async function () {
  console.log(`context.environment: ${JSON.stringify(context.environment)}`);

  const { serviceName, dbName } = context.environment.values;

  const mongoDb = context.services.get(serviceName).db(dbName);
  const gamesCollection = mongoDb.collection('games');
  const currGame = await gamesCollection.findOne({ current: true });
  if (currGame) {
    console.log('got the current game: ', JSON.stringify(currGame));
    const date = new Date();
    let nextGameDate;
    if (currGame.nextGameAt) {
      nextGameDate = new Date(currGame.nextGameAt);
      nextGameDate.setUTCDate(nextGameDate.getDate() + 1);
    } else {
      nextGameDate = new Date(currGame.playableAt);
      nextGameDate.setUTCDate(nextGameDate.getDate() + 2);
    }

    // nextGameDate.setUTCDate(nextGameDate.getDate() + 1);

    await gamesCollection.bulkWrite(
      [
        {
          updateOne: {
            filter: { gameNo: currGame.gameNo + 1 },
            update: {
              $set: {
                current: true,
                active: true,
                updatedAt: date,
                playedAt: date,
                nextGameAt: nextGameDate,
              },
            },
          },
        },
        {
          updateOne: {
            filter: { _id: currGame._id },
            update: { $set: { current: false, updatedAt: date } },
          },
        },
      ],
      { ordered: true }
    );

    console.log('after the bulkWrite Op');
  } else {
    console.log('Error! No current game found.');
  }
};
