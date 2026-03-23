/**
 * Cloudflare R2 Storage Service
 * Handles file operations with Cloudflare R2 S3-compatible storage
 */

const R2_CONFIG = {
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
  secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  bucket: import.meta.env.VITE_R2_BUCKET,
  publicBaseUrl: import.meta.env.VITE_R2_PUBLIC_BASE_URL,
};

interface R2Object {
  Key: string;
  LastModified?: Date;
  Size?: number;
  StorageClass?: string;
}

class R2Service {
  private baseUrl: string;
  private credentials: string;

  constructor() {
    this.baseUrl = `${R2_CONFIG.endpoint}/${R2_CONFIG.bucket}`;
    this.credentials = btoa(`${R2_CONFIG.accessKeyId}:${R2_CONFIG.secretAccessKey}`);
  }

  /**
    * Delete a file from R2 storage via Cloudflare Worker to avoid CORS issues
    * @param fileUrl - The full URL of the file to delete
    * @returns Promise<boolean> - True if deleted successfully
    */
   async deleteFile(fileUrl: string): Promise<boolean> {
     try {
       if (!fileUrl) return true; // No file to delete

       // Extract the key from the URL
       const key = this.extractKeyFromUrl(fileUrl);
       if (!key) {
         console.warn('Could not extract key from URL:', fileUrl);
         return false;
       }

       console.log('Attempting to delete R2 file via Cloudflare Worker:', key);

       // Use Cloudflare Worker for R2 operations
       const workerUrl = import.meta.env.VITE_R2_WORKER_URL || '/api/r2/delete';
       const response = await fetch(workerUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           key: key,
           url: fileUrl
         }),
       });

       if (response.ok) {
         const result = await response.json();
         console.log('Successfully deleted file from R2 via Cloudflare Worker:', key, result);
         return true;
       } else {
         // Try to get more detailed error information
         let errorText = response.statusText;
         try {
           const errorBody = await response.text();
           if (errorBody) {
             errorText += ` - ${errorBody}`;
           }
         } catch (e) {
           // Ignore error reading response body
         }

         console.error('Failed to delete file from R2 via Cloudflare Worker:', response.status, errorText);

         // Return true for 404 (file not found) as it's effectively deleted
         if (response.status === 404) {
           console.log('File not found in R2 (already deleted or never existed):', key);
           return true;
         }

         return false;
       }
     } catch (error) {
       console.error('Error deleting file from R2 via Cloudflare Worker:', error);
       return false;
     }
   }

  /**
   * Delete multiple files from R2 storage
   * @param fileUrls - Array of file URLs to delete
   * @returns Promise<boolean[]> - Array of deletion results
   */
  async deleteFiles(fileUrls: string[]): Promise<boolean[]> {
    const results = await Promise.allSettled(
      fileUrls.map(url => this.deleteFile(url))
    );

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : false
    );
  }

  /**
    * Extract the object key from a full R2 URL
    * @param url - The full URL of the file
    * @returns string | null - The object key or null if not found
    */
   private extractKeyFromUrl(url: string): string | null {
     try {
       // If it's already just a key/path, return it
       if (!url.includes('://')) {
         return url;
       }

       // Extract from full URL
       const urlObj = new URL(url);
       let pathParts = urlObj.pathname.split('/').filter(Boolean);

       // Remove bucket name if present in the path
       if (pathParts.length > 0 && pathParts[0] === R2_CONFIG.bucket) {
         pathParts.shift();
       }

       // If no path parts remain, try to get the key from the URL differently
       if (pathParts.length === 0) {
         // Try to extract from the full URL by removing the base URL
         const baseUrl = `${R2_CONFIG.endpoint}/${R2_CONFIG.bucket}/`;
         if (url.startsWith(baseUrl)) {
           return url.substring(baseUrl.length);
         }

         // Try with public base URL
         const publicBaseUrl = `${R2_CONFIG.publicBaseUrl}/`;
         if (url.startsWith(publicBaseUrl)) {
           return url.substring(publicBaseUrl.length);
         }
       }

       const key = pathParts.join('/');
       console.log('Extracted key from URL:', url, '->', key);
       return key;
     } catch (error) {
       console.error('Error parsing URL:', error, 'URL:', url);
       return null;
     }
   }

  /**
   * Check if a URL is from our R2 storage
   * @param url - The URL to check
   * @returns boolean - True if URL is from our R2 storage
   */
  isR2Url(url: string): boolean {
    if (!url) return false;
    return url.includes(R2_CONFIG.publicBaseUrl) || url.includes(R2_CONFIG.endpoint);
  }

  /**
   * Get the public URL for a file key
   * @param key - The object key
   * @returns string - The public URL
   */
  getPublicUrl(key: string): string {
    return `${R2_CONFIG.publicBaseUrl}/${key}`;
  }
}

// Export singleton instance
export const r2Service = new R2Service();
export default r2Service;