import { useState } from 'react';
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
  FileUploadList,
} from '@/components/ui/file-upload';
import { useUploadTalentMedia } from '@/hooks/use-talent';
import { Upload, X } from 'lucide-react';

type AddTalentMediaDialogProps = {
  talentId: string;
  trigger?: React.ReactNode;
};

export const AddTalentMediaDialog: React.FC<AddTalentMediaDialogProps> = ({
  talentId,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMedia = useUploadTalentMedia();

  const handleClose = () => {
    setPendingFiles([]);
    setOpen(false);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    for (const file of pendingFiles) {
      const base64 = await fileToBase64(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      await uploadMedia.mutateAsync({
        talentId,
        type,
        base64Data: base64,
        filename: file.name,
      });
    }
    setIsUploading(false);
    handleClose();
  };

  const isPending = isUploading || uploadMedia.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Add Media</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Reference Media</DialogTitle>
          <DialogDescription>
            Upload images or videos to use as reference for this talent.
          </DialogDescription>
        </DialogHeader>

        <FileUpload
          accept="image/*,video/*"
          maxSize={100 * 1024 * 1024}
          multiple
          disabled={isPending}
          value={pendingFiles}
          onValueChange={setPendingFiles}
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
            {pendingFiles.map((file) => (
              <FileUploadItem
                key={file.name + file.lastModified}
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

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleUpload}
            disabled={isPending || pendingFiles.length === 0}
          >
            {isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
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
