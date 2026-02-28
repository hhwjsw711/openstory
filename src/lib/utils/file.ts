/**
 * File utilities — extension extraction and MIME type mapping.
 */

export function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() || 'jpg';
  } catch {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    return match?.[1]?.toLowerCase() || 'jpg';
  }
}

export function getMimeTypeFromExtension(ext: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}
