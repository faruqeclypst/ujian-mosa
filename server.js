/**
 * Simple Express server to handle R2 operations and avoid CORS issues
 * Run with: node server.js
 */

const express = require('express');
const cors = require('cors');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 5173;

// Middleware
app.use(cors());
app.use(express.json());

// R2 Configuration
const R2_CONFIG = {
  endpoint: process.env.VITE_R2_ENDPOINT,
  accessKeyId: process.env.VITE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY,
  bucket: process.env.VITE_R2_BUCKET,
};

// Initialize S3 client for R2
let s3Client = null;

const getS3Client = () => {
  if (!s3Client) {
    if (!R2_CONFIG.endpoint || !R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey) {
      throw new Error('R2 configuration incomplete. Check environment variables.');
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_CONFIG.endpoint,
      credentials: {
        accessKeyId: R2_CONFIG.accessKeyId,
        secretAccessKey: R2_CONFIG.secretAccessKey,
      },
    });
  }
  return s3Client;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'R2 proxy server is running' });
});

// Delete file endpoint
app.post('/r2/presign/delete', async (req, res) => {
  try {
    const { key, url } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    console.log('Deleting file from R2:', key);

    const client = getS3Client();

    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
    });

    await client.send(deleteCommand);

    console.log('Successfully deleted file from R2:', key);
    res.json({
      success: true,
      message: 'File deleted successfully',
      key: key
    });

  } catch (error) {
    console.error('Error deleting file from R2:', error);

    // If file not found, return success (it's effectively deleted)
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log('File not found in R2 (already deleted):', req.body.key);
      return res.json({
        success: true,
        message: 'File not found (already deleted)',
        key: req.body.key
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 R2 Proxy Server running on http://localhost:${PORT}`);
  console.log(`📁 Health check: http://localhost:${PORT}/health`);
  console.log(`🗑️  Delete endpoint: http://localhost:${PORT}/r2/presign/delete`);
});