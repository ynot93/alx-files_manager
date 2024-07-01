const fs = require('fs');
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const Bull = require('bull');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const thumbNailQueue = new Bull('fileQueue');
const fileCollection = dbClient.client.db().collection('files');

async function postUpload(req, resp) {
  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  const token = req.headers['x-token'];
  const { name, type, data, parentId: rawParentId, isPublic = false } = req.body;

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  if (!name) {
    return resp.status(400).json({ error: 'Missing name' });
  }

  if (!type) {
    return resp.status(400).json({ error: 'Missing type' });
  }

  if (!data && type !== 'folder') {
    return resp.status(400).json({ error: 'Missing data' });
  }

  let parentId = rawParentId ? ObjectId(rawParentId) : 0;

  if (rawParentId) {
    const parentFolder = await fileCollection.findOne({ _id: parentId });
    if (!parentFolder) {
      return resp.status(400).json({ error: 'Parent not found' });
    }
    if (parentFolder.type !== 'folder') {
      return resp.status(400).json({ error: 'Parent is not a folder' });
    }
  }

  if (type === 'folder') {
    const { insertedId: fileId } = await fileCollection.insertOne({
      name,
      type,
      parentId,
      userId: ObjectId(userId),
    });

    return resp.status(201).json({
      id: fileId.toString(),
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const buffer = Buffer.from(data, 'base64');
  const fileUuid = uuidv4();
  fs.writeFileSync(`${folderPath}/${fileUuid}`, buffer);

  const { insertedId: fileId } = await fileCollection.insertOne({
    userId: ObjectId(userId),
    name,
    type,
    isPublic,
    parentId,
    localPath: `${folderPath}/${fileUuid}`,
  });

  if (type === 'image') {
    await thumbNailQueue.add({ userId, fileId: fileId.toString() });
  }

  return resp.status(201).json({
    id: fileId.toString(),
    userId,
    name,
    type,
    isPublic,
    parentId,
  });
}

async function getShow(req, resp) {
  const { id: fileId } = req.params;
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const document = await fileCollection.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!document) {
    return resp.status(404).json({ error: 'Not found' });
  }

  const { _id, localPath, ...rest } = document;
  return resp.status(200).json({ id: _id.toString(), ...rest });
}

async function getIndex(req, resp) {
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const { parentId: rawParentId, page = 0 } = req.query;
  const parentId = rawParentId ? ObjectId(rawParentId) : null;

  const matchingCriteria = { userId: ObjectId(userId) };
  if (parentId) {
    matchingCriteria.parentId = parentId;
  }

  const results = await fileCollection.aggregate([
    { $match: matchingCriteria },
    { $skip: page * 20 },
    { $limit: 20 },
    {
      $project: {
        _id: 0,
        id: '$_id',
        userId: 1,
        name: 1,
        type: 1,
        isPublic: 1,
        parentId: 1,
      },
    },
  ]).toArray();

  return resp.status(200).json(results);
}

async function putPublish(req, resp) {
  const { id: documentId } = req.params;
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const { matchedCount } = await fileCollection.updateOne(
    { _id: ObjectId(documentId), userId: ObjectId(userId) },
    { $set: { isPublic: true } },
  );

  if (matchedCount === 0) {
    return resp.status(404).json({ error: 'Not found' });
  }

  const document = await fileCollection.findOne({ _id: ObjectId(documentId) });
  const { _id, localPath, ...rest } = document;
  return resp.status(200).json({ id: _id.toString(), ...rest });
}

async function putUnpublish(req, resp) {
  const { id: documentId } = req.params;
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const { matchedCount } = await fileCollection.updateOne(
    { _id: ObjectId(documentId), userId: ObjectId(userId) },
    { $set: { isPublic: false } },
  );

  if (matchedCount === 0) {
    return resp.status(404).json({ error: 'Not found' });
  }

  const document = await fileCollection.findOne({ _id: ObjectId(documentId) });
  const { _id, localPath, ...rest } = document;
  return resp.status(200).json({ id: _id.toString(), ...rest });
}

async function getFile(req, resp) {
  const token = req.headers['x-token'];
  let userId = null;

  if (token) {
    userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      userId = null;
    }
  }

  const { id: documentId } = req.params;
  const { size } = req.query;

  const document = await fileCollection.findOne({ _id: ObjectId(documentId) });

  if (!document) {
    return resp.status(404).json({ error: 'Not found' });
  }

  if (!document.isPublic && (!userId || !ObjectId(userId).equals(document.userId))) {
    return resp.status(404).json({ error: 'Not found' });
  }

  if (document.type === 'folder') {
    return resp.status(400).json({ error: "A folder doesn't have content" });
  }

  let { localPath } = document;
  if (size) {
    localPath = `${localPath}_${size}`;
  }

  try {
    const data = await fs.promises.readFile(localPath);
    const mimeType = mime.lookup(document.name);
    resp.setHeader('Content-Type', mimeType);
    return resp.status(200).send(data);
  } catch (error) {
    return resp.status(404).json({ error: 'Not found' });
  }
}

module.exports = {
  postUpload,
  getShow,
  getIndex,
  putPublish,
  putUnpublish,
  getFile,
};
