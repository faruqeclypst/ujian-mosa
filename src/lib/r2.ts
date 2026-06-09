/**
 * Cloudflare R2 Storage Service
 * File operations go through Cloudflare Worker — no credentials in frontend.
 */

const R2_CONFIG = {
  publicBaseUrl: import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined,
  workerUrl: import.meta.env.VITE_R2_WORKER_URL as string | undefined,
};

class R2Service {
  /**
   * Delete a file from R2 storage via Cloudflare Worker
   * @param fileUrl - The full URL of the file to delete
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      if (!fileUrl) return true;

      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        console.warn('Could not extract key from URL:', fileUrl);
        return false;
      }

      const workerUrl = R2_CONFIG.workerUrl;
      if (!workerUrl) {
        console.error('VITE_R2_WORKER_URL is not configured');
        return false;
      }

      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, url: fileUrl, bucket: 'piket' }),
      });

      if (response.status === 404) return true; // already deleted
      return response.ok;
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      return false;
    }
  }

  /**
   * Delete multiple files from R2 storage
   */
  async deleteFiles(fileUrls: string[]): Promise<boolean[]> {
    const results = await Promise.allSettled(fileUrls.map(url => this.deleteFile(url)));
    return results.map(r => r.status === 'fulfilled' ? r.value : false);
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      if (!url.includes('://')) return url;
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const publicBaseUrl = R2_CONFIG.publicBaseUrl;
      if (publicBaseUrl) {
        const base = publicBaseUrl.replace(/\/$/, '') + '/';
        if (url.startsWith(base)) return url.substring(base.length);
      }
      return pathParts.join('/') || null;
    } catch {
      return null;
    }
  }

  isR2Url(url: string): boolean {
    if (!url || !R2_CONFIG.publicBaseUrl) return false;
    return url.startsWith(R2_CONFIG.publicBaseUrl);
  }

  getPublicUrl(key: string): string {
    return `${R2_CONFIG.publicBaseUrl}/${key}`;
  }
}

export const r2Service = new R2Service();
export default r2Service;
