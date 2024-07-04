/* eslint-disable import/no-named-as-default */
import sha1 from 'sha1';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { MongoClient, ObjectId } = require('mongodb');

const userQueue = new Queue('email sending');

export default class UsersController {
  static async postUser(req, res) {
    console.log(req.body);
    const email = req.body ? req.body.email : null;
    const password = req.body ? req.body.password : null;

    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    const user = await (await dbClient.usersCollection()).findOne({ email });

    if (user) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const insertionInfo = await (await dbClient.usersCollection())
      .insertOne({ email, password: sha1(password) });
    const userId = insertionInfo.insertedId.toString();

    userQueue.add({ userId });
    res.status(201).json({ email, id: userId });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const key = `auth_${token}`;
    await redisClient.get(key, async (err, userId) => {
      if (err || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const client = new MongoClient('mongodb://localhost:27017');
      try {
        await client.connect();
        const db = client.db('files_manager');
        const usersCollection = db.collection('users');

        const user = (await usersCollection.findOne(
          { _id: ObjectId(userId) }, { projection: { email: 1 } },
        ));
        if (!user) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        res.status(200).json({ id: user._id, email: user.email });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      } finally {
        await client.close();
      }
    });
  }
}
