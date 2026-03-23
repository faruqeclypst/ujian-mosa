/**
 * Vercel API Route for R2 Image Deletion
 * Replaces the Express server functionality for Cloudflare R2 operations
 */

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// R2 Configuration from environment variables
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

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { key, url } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    console.log('=== VERCEL API: Deleting file from R2 ===');
    console.log('Key:', key);
    console.log('Environment check:', {
      endpoint: R2_CONFIG.endpoint ? 'SET' : 'MISSING',
      accessKey: R2_CONFIG.accessKeyId ? 'SET' : 'MISSING',
      secretKey: R2_CONFIG.secretAccessKey ? 'SET' : 'MISSING',
      bucket: R2_CONFIG.bucket ? 'SET' : 'MISSING'
    });

    const client = getS3Client();

    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
    });

    await client.send(deleteCommand);

    console.log('=== VERCEL API: Successfully deleted file ===');
    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      key: key
    });

  } catch (error) {
    console.error('=== VERCEL API: Error deleting file ===', error);

    // If file not found, return success (it's effectively deleted)
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log('=== VERCEL API: File not found (already deleted) ===');
      return res.status(200).json({
        success: true,
        message: 'File not found (already deleted)',
        key: req.body?.key
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
};