/* eslint-disable import/no-named-as-default */
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const redis = require('redis');

const redisClient = redis.createClient();

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

    const client = new MongoClient('mongodb://localhost:27017');
    try {
      await client.connect();
      const db = client.db('files_manager');
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ email, password: hashedPassword });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = uuidv4();
      const key = `auth_${token}`;
      redisClient.setex(key, 86400, user._id.toString());

      return res.status(200).json({ token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      await client.close();
    }
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const key = `auth_${token}`;
    redisClient.del(key, (err, response) => {
      if (response === 1) {
        res.status(204).end();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });
  }
}

module.exports = AuthController;
