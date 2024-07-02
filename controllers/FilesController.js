const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');
const fileQueue = require('../worker');
const { v4: uuidv4 } = require('uuid');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.getFileById(parentId);
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId: parentId !== 0 ? ObjectId(parentId) : 0,
    };

    if (type === 'folder') {
      const newFile = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({ ...fileDocument });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    await fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    fileDocument.localPath = localPath;
    const newFile = await dbClient.db.collection('files').insertOne(fileDocument);

    if (type === 'image') {
      await fileQueue.add({ userId, fileId: newFile._id.toString() });
    }

    return res.status(201).json({ ...fileDocument });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    let file;
    try {
      file = await dbClient.getFileById(fileId);
    } catch (error) {
      console.error(`Error fetching file from database: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!file || file.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = req.query;
    const limit = 20;
    const skip = page * limit;

    let filter;
    if (parentId !== 0) {
      filter = { parentId: ObjectId(parentId), userId };
    } else {
      filter = { userId };
    }

    const files = await dbClient.filesCollection()
      .find(filter)
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.json(files);
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    let file;
    try {
      file = await dbClient.getFileById(fileId);
    } catch (error) {
      console.error(`Error fetching file from database: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic && file.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    const size = req.query.size;
    let localPath = file.localPath;

    if (size && ['100', '250', '500'].includes(size)) {
      localPath = `${localPath}_${size}`;
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
  }
}

module.exports = FilesController;
