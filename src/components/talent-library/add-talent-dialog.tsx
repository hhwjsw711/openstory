import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  type FileUploadProps,
} from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTalent, useUploadTempMedia } from '@/hooks/use-talent';
import { Plus, Upload, X } from 'lucide-react';

type AddTalentDialogProps = {
  trigger?: React.ReactNode;
};

export const AddTalentDialog: React.FC<AddTalentDialogProps> = ({
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  // Track uploaded URLs by file key (name + lastModified)
  const [uploadedUrls, setUploadedUrls] = useState<Map<string, string>>(
    new Map()
  );

  const createTalent = useCreateTalent();
  const uploadTempMedia = useUploadTempMedia();

  const handleClose = () => {
    setFiles([]);
    setUploadedUrls(new Map());
    setOpen(false);
  };

  const getFileKey = (file: File) => `${file.name}-${file.lastModified}`;

  const onUpload: NonNullable<FileUploadProps['onUpload']> = useCallback(
    async (newFiles, { onProgress, onSuccess, onError }) => {
      const uploadPromises = newFiles.map(async (file) => {
        try {
          onProgress(file, 10);

          const base64 = await fileToBase64(file);
          onProgress(file, 30);

          const type = file.type.startsWith('video/') ? 'video' : 'image';
          const result = await uploadTempMedia.mutateAsync({
            base64Data: base64,
            filename: file.name,
            type,
          });

          // Store the URL for images (used in sheet generation)
          if (type === 'image') {
            setUploadedUrls((prev) =>
              new Map(prev).set(getFileKey(file), result.url)
            );
          }

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
    },
    [uploadTempMedia]
  );

  const handleValueChange = (newFiles: File[]) => {
    setFiles(newFiles);
    // Clean up URLs for removed files
    const currentKeys = new Set(newFiles.map(getFileKey));
    setUploadedUrls((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!currentKeys.has(key)) {
          next.delete(key);
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get('name');
    const descriptionValue = formData.get('description');

    const name = typeof nameValue === 'string' ? nameValue : '';
    const description =
      typeof descriptionValue === 'string' ? descriptionValue : '';

    if (!name.trim()) return;

    // Get all uploaded image URLs
    const referenceImageUrls = Array.from(uploadedUrls.values());

    createTalent.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        isHuman: true,
        referenceImageUrls,
      },
      {
        onSuccess: () => handleClose(),
      }
    );
  };

  const isUploading = uploadTempMedia.isPending;
  const isPending = createTalent.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Talent
          </Button>
        )}
      </DialogTrigger>
      <form onSubmit={handleSubmit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Talent</DialogTitle>
            <DialogDescription>
              Add a new talent to your library.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Talent name…"
                autoComplete="off"
                autoFocus
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the talent's appearance, style…"
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Reference Media</Label>
              <FileUpload
                accept="image/*,video/*"
                maxSize={100 * 1024 * 1024}
                multiple
                disabled={isPending}
                value={files}
                onValueChange={handleValueChange}
                onUpload={onUpload}
              >
                <FileUploadDropzone className="min-h-[120px]">
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">
                    Drag & drop, click to upload, or paste
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Images and videos up to 100MB
                  </p>
                </FileUploadDropzone>

                <FileUploadList className="grid grid-cols-3 gap-3">
                  {files.map((file) => (
                    <FileUploadItem
                      key={getFileKey(file)}
                      value={file}
                      className="relative aspect-square p-0 border-0 overflow-hidden rounded-lg group"
                    >
                      <FileUploadItemPreview
                        className="size-full rounded-none border-0"
                        render={(file, fallback) =>
                          file.type.startsWith('video/') ? (
                            <video
                              src={URL.createObjectURL(file)}
                              className="size-full object-cover"
                            />
                          ) : (
                            fallback()
                          )
                        }
                      />
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
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || isUploading}>
              {isPending
                ? 'Creating…'
                : isUploading
                  ? 'Uploading…'
                  : 'Add Talent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
};

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
