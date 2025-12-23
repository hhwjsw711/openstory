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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTalent, useUploadTalentMedia } from '@/hooks/use-talent';
import { Plus, Upload, X } from 'lucide-react';

type AddTalentDialogProps = {
  trigger?: React.ReactNode;
};

export const AddTalentDialog: React.FC<AddTalentDialogProps> = ({
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const createTalent = useCreateTalent();
  const uploadMedia = useUploadTalentMedia();

  const handleClose = () => {
    setPendingFiles([]);
    setOpen(false);
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

    createTalent.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        isHuman: true,
      },
      {
        onSuccess: async (newTalent) => {
          if (pendingFiles.length > 0) {
            setIsUploading(true);

            for (const file of pendingFiles) {
              const base64 = await fileToBase64(file);
              const type = file.type.startsWith('video/') ? 'video' : 'image';
              await uploadMedia.mutateAsync({
                talentId: newTalent.id,
                type,
                base64Data: base64,
                filename: file.name,
              });
            }
            setIsUploading(false);
          }
          handleClose();
        },
      }
    );
  };

  const isPending = createTalent.isPending || isUploading;

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
                onAccept={(files) =>
                  setPendingFiles((prev) => [...prev, ...files])
                }
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
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isUploading
                  ? 'Uploading media…'
                  : 'Creating…'
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
