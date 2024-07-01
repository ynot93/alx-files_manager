const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

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

    if (!['folder', 'file', 'image'].includes(type)) {
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
      parentId: parentId !== 0 ? parentId : 0,
    };

    if (type === 'folder') {
      const newFile = await dbClient.createFile(fileDocument);
      return res.status(201).json(newFile);
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    fileDocument.localPath = localPath;
    const newFile = await dbClient.createFile(fileDocument);
    return res.status(201).json(newFile);
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
    const limit = 20; // Number of items per page

    let files;
    try {
      files = await dbClient.filesCollection()
        .find({ userId: ObjectId(userId), parentId: parentId !== '0' ? ObjectId(parentId) : 0 })
        .skip(page * limit)
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error fetching files from database: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    return res.json(files);
  }

  static async putPublish(req, res) {
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

    try {
      await dbClient.filesCollection().updateOne(
        { _id: ObjectId(fileId) },
        { $set: { isPublic: true } }
      );
      file.isPublic = true;
      return res.json(file);
    } catch (error) {
      console.error(`Error updating file in database: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(req, res) {
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

    try {
      await dbClient.filesCollection().updateOne(
        { _id: ObjectId(fileId) },
        { $set: { isPublic: false } }
      );
      file.isPublic = false;
      return res.json(file);
    } catch (error) {
      console.error(`Error updating file in database: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
