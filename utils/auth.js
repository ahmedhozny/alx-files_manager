// eslint-disable-next-line import/no-named-as-default
import dbClient from './db';

const getUserFromXToken = async (token) => {
  if (!token) return null;

  const res = await dbClient.usersCollection().findOne({ token });
  return res;
};

export default getUserFromXToken;
