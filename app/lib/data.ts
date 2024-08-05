import { ObjectId } from 'mongodb';
import mongoClientPromise from '@/app/lib/mongodb';
import { Game } from '@/app/lib/types';

type DbGame = Omit<Game, '_id'> & { _id: ObjectId };

export async function fetchGame(gameNo?: number): Promise<Game | null> {
  const client = await mongoClientPromise;

  const db = client.db(process.env.DB_NAME);
  const filter = gameNo
    ? {
        active: true,
        gameNo,
      }
    : { current: true };

  const dbGame = await db.collection<DbGame>('games').findOne(filter);

  console.log('fetched db game', dbGame);

  return dbGame ? { ...dbGame, _id: dbGame._id.toString() } : null;
}
