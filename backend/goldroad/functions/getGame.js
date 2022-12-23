exports = async function (req, res) {
  const { serviceName, dbName } = context.environment.values;

  const mongoDb = context.services.get(serviceName).db(dbName);
  const gamesCollection = mongoDb.collection('games');
  console.log(`req.query is: ${JSON.stringify(req.query)}`);
  const { num } = req.query;
  let filter = { current: true };
  if (num) {
    filter = { gameNo: parseInt(num), active: true };
  }

  console.log(`final filter is: ${JSON.stringify(filter)}`);

  const currGame = await gamesCollection.findOne(filter);

  console.log(`got game: ${JSON.stringify(currGame)}`);

  if (currGame) {
    res.setBody(JSON.stringify({ status: 'OK', game: currGame }));
  } else {
    res.setStatusCode(404);
    res.setBody(
      JSON.stringify({
        status: 'ERROR',
        message: 'The requested game was not found',
      })
    );
  }

  return res;
};
