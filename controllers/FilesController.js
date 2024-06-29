// controllers/FilesController.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const { ObjectID } = require('mongodb');

class FilesController {
  static async postUpload(req, res) {
    const { name, type, parentId = 0, isPublic = false, data } = req.body;
    const userId = req.userId;

    // Validation checks
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid type' });
    }
    if ((type !== 'folder') && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Check if parentId is valid and parent is a folder
    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({
        _id: new ObjectID(parentId),
        type: 'folder'
      });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }

    let localPath = '';
    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const fileUuid = uuidv4();
      localPath = path.join(folderPath, fileUuid);

      const fileContent = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, fileContent);
    }

    // Prepare file object to store in MongoDB
    const newFile = {
      userId: new ObjectID(userId),
      name,
      type,
      isPublic,
      parentId: new ObjectID(parentId),
      localPath: (type !== 'folder') ? localPath : null
    };

    // Save the new file in MongoDB
    const result = await dbClient.db.collection('files').insertOne(newFile);

    // Response with the created file object
    res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId
    });
  }

  static async getShow (req, res) {
    try {
      const userId = await retrieveUserIdFromToken(req.headers['x-token']);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;
      const file = await File.findById(fileId).exec();

      if (!file || file.userId.toString() !== userId) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.json(file);
    } catch (error) {
      console.error('Error retrieving file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /files
  static async getIndex (req, res) {
    try {
      const userId = await retrieveUserIdFromToken(req.headers['x-token']);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parentId = req.query.parentId || '0';
      const page = parseInt(req.query.page) || 0;
      const perPage = 20;
      const skip = page * perPage;

      const files = await File.find({ userId, parentId })
        .skip(skip)
        .limit(perPage)
        .exec();

      return res.json(files);
    } catch (error) {
      console.error('Error retrieving files:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
