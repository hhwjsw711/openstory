import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateTalent,
  useUpdateTalent,
  useUploadTalentMedia,
  useDeleteTalentMedia,
  useGenerateTalentSheet,
} from '@/hooks/use-talent';
import type { Talent, TalentMediaRecord, TalentSheet } from '@/lib/db/schema';
import { Pencil, Plus, Upload, X } from 'lucide-react';

type TalentWithRelations = Talent & {
  sheets: TalentSheet[];
  media: TalentMediaRecord[];
};

type PendingFile = {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
};

type TalentLibraryDialogProps =
  | {
      mode: 'create';
      trigger?: React.ReactNode;
    }
  | {
      mode: 'edit';
      talent: TalentWithRelations;
      trigger?: React.ReactNode;
    };

export const TalentLibraryDialog: React.FC<TalentLibraryDialogProps> = (
  props
) => {
  const { mode, trigger } = props;
  const talent = mode === 'edit' ? props.talent : null;

  const [open, setOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTalent = useCreateTalent();
  const updateTalent = useUpdateTalent();
  const uploadMedia = useUploadTalentMedia();
  const deleteMedia = useDeleteTalentMedia();
  const generateSheet = useGenerateTalentSheet();

  const handleClose = () => {
    for (const file of pendingFiles) {
      URL.revokeObjectURL(file.preview);
    }
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

    if (mode === 'create') {
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

              // Upload all files
              for (const pendingFile of pendingFiles) {
                const base64 = await fileToBase64(pendingFile.file);
                await uploadMedia.mutateAsync({
                  talentId: newTalent.id,
                  type: pendingFile.type,
                  base64Data: base64,
                  filename: pendingFile.file.name,
                });
              }
              setIsUploading(false);
            }
            handleClose();
          },
        }
      );
    } else if (talent) {
      updateTalent.mutate(
        {
          talentId: talent.id,
          name: name.trim(),
          description: description.trim() || undefined,
        },
        {
          onSuccess: () => setOpen(false),
        }
      );
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (mode === 'create') {
      const newPendingFiles: PendingFile[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
      }));
      setPendingFiles((prev) => [...prev, ...newPendingFiles]);
    } else if (talent) {
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        await uploadMedia.mutateAsync({
          talentId: talent.id,
          type,
          base64Data: base64,
          filename: file.name,
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePendingFile = (id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!talent) return;

    await deleteMedia.mutateAsync({
      mediaId,
      talentId: talent.id,
    });
  };

  const isPending =
    createTalent.isPending ||
    updateTalent.isPending ||
    isUploading ||
    uploadMedia.isPending;

  const defaultTrigger =
    mode === 'create' ? (
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Add Talent
      </Button>
    ) : (
      <Button variant="outline" size="icon">
        <Pencil className="h-4 w-4" />
      </Button>
    );

  const mediaItems = mode === 'create' ? pendingFiles : (talent?.media ?? []);
  const hasMedia = mediaItems.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}
    >
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add Talent' : 'Edit Talent'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Add a new talent to your library.'
                : 'Update talent details and reference media.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={talent?.name ?? ''}
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
                  defaultValue={talent?.description ?? ''}
                  placeholder="Describe the talent's appearance, style…"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Reference Media</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadMedia.isPending ? 'Uploading…' : 'Upload'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Upload reference images or videos to help the AI understand how
                this talent should look.
              </p>

              {hasMedia ? (
                <div className="grid grid-cols-3 gap-3">
                  {mode === 'create'
                    ? pendingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
                        >
                          {file.type === 'image' ? (
                            <img
                              src={file.preview}
                              alt="Reference"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={file.preview}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemovePendingFile(file.id)}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    : talent?.media.map((media) => (
                        <div
                          key={media.id}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
                        >
                          {media.type === 'image' ? (
                            <img
                              src={media.url}
                              alt="Reference"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={media.url}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteMedia(media.id)}
                            disabled={deleteMedia.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-8 text-center">
                  <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No reference media{' '}
                    {mode === 'create' ? 'added' : 'uploaded'} yet
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isUploading
                  ? 'Uploading media…'
                  : mode === 'create'
                    ? 'Creating…'
                    : 'Saving…'
                : mode === 'create'
                  ? 'Add Talent'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
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
