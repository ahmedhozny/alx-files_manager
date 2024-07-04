import dbClient from "../utils/db";
import sha1 from 'sha1';
import Queue from "bull";
import redisClient from "../utils/redis";
const { MongoClient, ObjectId } = require('mongodb');

const userQueue = new Queue('email sending');

export default class UsersController{
  static async postUser(req, res) {
    const email = req.body ? req.body.email : null;
    const password = req.body ? req.body.password : null;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });

    }
    const user = await (await dbClient.usersCollection()).findOne({ email });

    if (user) {
      return res.status(400).json({ error: 'Already exist' });
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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    await redisClient.get(key, async (err, userId) => {
      if (err || !userId) {
        return res.status(401).json({error: 'Unauthorized'});
      }

      const client = new MongoClient('mongodb://localhost:27017');
      try {
        await client.connect();
        const db = client.db('files_manager');
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({_id: ObjectId(userId)}, {projection: {email: 1}});
        if (!user) {
          return res.status(401).json({error: 'Unauthorized'});
        }

        return res.status(200).json({id: user._id, email: user.email});
      } catch (error) {
        console.error(error);
        return res.status(500).json({error: 'Internal server error'});
      } finally {
        await client.close();
      }
    });
  }
}
