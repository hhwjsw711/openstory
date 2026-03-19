/**
 * Client-side upload utilities using XHR for progress reporting.
 * fetch() doesn't support upload progress — XHR does via upload.onprogress.
 */

export function getFileKey(file: File): string {
  return `${file.name}-${file.lastModified}`;
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body: JSON.parse(xhr.responseText) as unknown,
      });
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.open('PUT', url);
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream'
    );
    xhr.withCredentials = true;
    xhr.send(file);
  });
}

/**
 * Upload a file to an API route with progress reporting and error handling.
 * Parses the JSON response once and throws on non-2xx status.
 */
export async function executeUpload<T>(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<T> {
  const response = await uploadWithProgress(
    url,
    file,
    onProgress ?? (() => {})
  );
  const body = response.body;
  if (!response.ok) {
    const errObj = body && typeof body === 'object' ? body : {};
    const errorMsg =
      'error' in errObj && typeof errObj.error === 'string'
        ? errObj.error
        : 'Upload failed';
    throw new Error(errorMsg);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller knows the JSON response shape from the server
  return body as T;
}
