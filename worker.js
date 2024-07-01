const Bull = require('bull');
const { ObjectId } = require('mongodb');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs').promises;
const dbClient = require('./utils/db');

const thumbNailQueue = new Bull('fileQueue');
const welcome = new Bull('userQueue');
const fileCollection = dbClient.client.db().collection('files');
const userCollection = dbClient.client.db().collection('users');

async function createThumbnail(localPath) {
  const task500 = imageThumbnail(localPath, { width: 500 });
  const task250 = imageThumbnail(localPath, { width: 250 });
  const task100 = imageThumbnail(localPath, { width: 100 });
  const [tn500, tn250, tn100] = await Promise.all([task500, task250, task100]);
  await Promise.all([
    fs.writeFile(`${localPath}_500`, tn500),
    fs.writeFile(`${localPath}_250`, tn250),
    fs.writeFile(`${localPath}_100`, tn100),
  ]);
}

thumbNailQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const file = await fileCollection.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });
  if (!file) {
    throw new Error('File not found');
  }
  try {
    await createThumbnail(file.localPath);
  } catch (error) {
    throw new Error('Error generating thumbnails');
  }
});

welcome.process(async (job) => {
  const { userId } = job.data;
  if (!userId) {
    throw new Error('Missing userId');
  }
  const user = await userCollection.findOne({ _id: ObjectId(userId) });
  if (!user) {
    throw new Error('User not found');
  }
  console.log(`Welcome ${user.email}!`);
});
