import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
  type FileUploadProps,
} from '@/components/ui/file-upload';
import { useUploadLocationMedia } from '@/hooks/use-location-library';
import { Upload, X } from 'lucide-react';

type LocationMediaUploadProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onUploadedUrlsChange?: (urls: string[]) => void;
  locationId?: string;
  onComplete?: () => void;
  disabled?: boolean;
  maxFiles?: number;
};

const getFileKey = (file: File) => `${file.name}-${file.lastModified}`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const LocationMediaUpload: React.FC<LocationMediaUploadProps> = ({
  files,
  onFilesChange,
  onUploadedUrlsChange,
  locationId,
  onComplete,
  disabled = false,
  maxFiles = 5,
}) => {
  const [, setUploadedUrls] = useState<Map<string, string>>(new Map());
  const uploadMedia = useUploadLocationMedia();

  const handleValueChange = useCallback(
    (newFiles: File[]) => {
      // Limit to maxFiles
      const limitedFiles = newFiles.slice(0, maxFiles);
      onFilesChange(limitedFiles);

      // Clean up URLs for removed files
      const currentKeys = new Set(limitedFiles.map(getFileKey));
      setUploadedUrls((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const key of next.keys()) {
          if (!currentKeys.has(key)) {
            next.delete(key);
            changed = true;
          }
        }
        if (changed) {
          onUploadedUrlsChange?.(Array.from(next.values()));
        }
        return changed ? next : prev;
      });
    },
    [onFilesChange, onUploadedUrlsChange, maxFiles]
  );

  const onUpload: NonNullable<FileUploadProps['onUpload']> = useCallback(
    async (newFiles, { onProgress, onSuccess, onError }) => {
      const uploadPromises = newFiles.map(async (file) => {
        try {
          onProgress(file, 10);

          const base64 = await fileToBase64(file);
          onProgress(file, 30);

          const result = await uploadMedia.mutateAsync({
            base64Data: base64,
            filename: file.name,
            locationId,
          });

          setUploadedUrls((prev) => {
            const next = new Map(prev).set(getFileKey(file), result.url);
            onUploadedUrlsChange?.(Array.from(next.values()));
            return next;
          });

          onProgress(file, 100);
          onSuccess(file);
        } catch (error) {
          onError(
            file,
            error instanceof Error ? error : new Error('Upload failed')
          );
        }
      });

      await Promise.all(uploadPromises);
      if (locationId) {
        onComplete?.();
      }
    },
    [locationId, uploadMedia, onUploadedUrlsChange, onComplete]
  );

  const isUploading = uploadMedia.isPending;

  return (
    <FileUpload
      accept="image/*"
      maxSize={50 * 1024 * 1024}
      multiple={maxFiles > 1}
      disabled={disabled || isUploading}
      value={files}
      onValueChange={handleValueChange}
      onUpload={onUpload}
    >
      <FileUploadDropzone
        className="min-h-[120px] focus:border-ring/50 focus:bg-accent/30"
        onClick={(e) => {
          e.preventDefault();
          e.currentTarget.focus();
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Drag & drop or paste</p>
        <FileUploadTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Browse files
          </Button>
        </FileUploadTrigger>
        <p className="text-xs text-muted-foreground">
          Images up to 50MB{maxFiles > 1 ? ` (max ${maxFiles})` : ''}
        </p>
      </FileUploadDropzone>

      <FileUploadList className="grid grid-cols-3 gap-3">
        {files.map((file) => (
          <FileUploadItem
            key={getFileKey(file)}
            value={file}
            className="relative aspect-video p-0 border-0 overflow-hidden rounded-lg group"
          >
            <FileUploadItemPreview className="size-full rounded-none border-0" />
            <FileUploadItemProgress className="absolute bottom-0 left-0 right-0 h-1" />
            <FileUploadItemDelete asChild>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </Button>
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
    </FileUpload>
  );
};
