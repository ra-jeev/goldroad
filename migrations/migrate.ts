import { MongoClient } from 'mongodb';
import { createHash } from 'crypto';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
} else if (!process.env.DB_NAME) {
  throw new Error('Missing environment variable: "DB_NAME"');
}

const uri = process.env.MONGODB_URI;
const options = {};

interface InputCoin {
  id: string;
  value: number;
  wall: number;
}

interface OutputDocument {
  coins: number[];
  walls: { [key: number]: number };
  hints: number[];
  start: number;
  end: number;
  rows: number;
  cols: number;
  boardScore: number;
}

function createGameHash(doc: OutputDocument): string {
  const gameString = JSON.stringify({
    coins: doc.coins,
    walls: doc.walls,
    start: doc.start,
    end: doc.end,
  });

  return createHash('sha256').update(gameString).digest('hex');
}

function processDocument(doc: any): OutputDocument {
  const coins: number[] = [];
  const walls: { [key: number]: number } = {};
  const hints: number[] = [];
  let boardScore = 0;

  doc.coins.forEach((row: InputCoin[], rowIndex: number) => {
    row.forEach((coin: InputCoin, colIndex: number) => {
      const index = rowIndex * row.length + colIndex;
      coins.push(coin.value);
      boardScore += coin.value;

      if (coin.wall > 0) {
        walls[index] = coin.wall;
      }
    });
  });

  const rows = doc.coins.length;
  const cols = doc.coins[0].length;

  const startIndex = parseInt(doc.start[0]) * cols + parseInt(doc.start[1]);
  const endIndex = parseInt(doc.end[0]) * cols + parseInt(doc.end[1]);
  doc.hints.forEach((hint: string) => {
    hints.push(parseInt(hint[0]) * cols + parseInt(hint[1]));
  });

  return {
    coins,
    walls,
    hints,
    start: startIndex,
    end: endIndex,
    rows,
    cols,
    boardScore,
  };
}
const performMigration = async () => {
  const client = await new MongoClient(uri, options).connect();
  const collection = client.db(process.env.DB_NAME).collection('games');

  const batchSize = 500;
  let processedCount = 0;

  while (true) {
    const cursor = collection.find({}).skip(processedCount).limit(batchSize);
    const bulkOps = [];

    for await (const doc of cursor) {
      const processedDoc = processDocument(doc);
      const gameHash = createGameHash(processedDoc);
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { hash: gameHash, ...processedDoc } },
        },
      });
    }

    if (bulkOps.length === 0) {
      break;
    }

    const result = await collection.bulkWrite(bulkOps);
    processedCount += result.modifiedCount;
    console.log(`Processed ${processedCount} documents so far`);
  }

  console.log(`Finished processing ${processedCount} documents`);

  client.close();
};

performMigration();
