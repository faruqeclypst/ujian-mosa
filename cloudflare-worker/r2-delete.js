/**
 * Cloudflare Worker for R2 File Deletion
 * Handles file deletion operations with Cloudflare R2 S3-compatible storage
 */

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const { key, url } = await request.json();

    if (!key) {
      return new Response(JSON.stringify({ error: 'File key is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    console.log('=== CLOUDFLARE WORKER: Deleting file from R2 ===');
    console.log('Key:', key);

    // Delete object from R2 using R2 binding
    try {
      // Check if the bucket binding exists
      if (!env.INVENTORY_BUCKET) {
        throw new Error('R2 bucket binding not found');
      }
      
      await env.INVENTORY_BUCKET.delete(key);

      console.log('=== CLOUDFLARE WORKER: Successfully deleted file ===');
      return new Response(JSON.stringify({
        success: true,
        message: 'File deleted successfully',
        key: key
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (deleteError) {
      // If file not found, return success (it's effectively deleted)
      if (deleteError.message.includes('No such object') || deleteError.message.includes('404')) {
        console.log('=== CLOUDFLARE WORKER: File not found (already deleted) ===');
        return new Response(JSON.stringify({
          success: true,
          message: 'File not found (already deleted)',
          key: key
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      console.error('=== CLOUDFLARE WORKER: Error deleting file ===', deleteError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to delete file',
        details: deleteError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

  } catch (error) {
    console.error('=== CLOUDFLARE WORKER: Error processing request ===', error);

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process request',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}