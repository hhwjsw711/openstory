'use client';

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
  useUpdateCharacter,
  useUploadCharacterMedia,
  useDeleteCharacterMedia,
} from '@/hooks/use-characters';
import type {
  Character,
  CharacterMediaRecord,
  CharacterSheet,
} from '@/lib/db/schema';

type CharacterForEdit = Character & {
  sheets: CharacterSheet[];
  media: CharacterMediaRecord[];
};
import { Pencil, Plus, Trash2, Upload, X } from 'lucide-react';

type EditCharacterDialogProps = {
  character: CharacterForEdit;
  trigger?: React.ReactNode;
};

export const EditCharacterDialog: React.FC<EditCharacterDialogProps> = ({
  character,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateCharacter = useUpdateCharacter();
  const uploadMedia = useUploadCharacterMedia();
  const deleteMedia = useDeleteCharacterMedia();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get('name');
    const descriptionValue = formData.get('description');

    const name = typeof nameValue === 'string' ? nameValue : '';
    const description =
      typeof descriptionValue === 'string' ? descriptionValue : '';

    if (!name.trim()) return;

    updateCharacter.mutate(
      {
        id: character.id,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      }
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        if (typeof base64 !== 'string') return;

        const type = file.type.startsWith('video/') ? 'video' : 'image';
        await uploadMedia.mutateAsync({
          characterId: character.id,
          type,
          base64Data: base64,
          filename: file.name,
        });
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    await deleteMedia.mutateAsync({
      mediaId,
      characterId: character.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Character</DialogTitle>
            <DialogDescription>
              Update character details and reference media.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-4">
            {/* Basic Info */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={character.name}
                  placeholder="Character name…"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={character.description ?? ''}
                  placeholder="Describe the character's appearance, personality, role…"
                  rows={3}
                />
              </div>
            </div>

            {/* Reference Media */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Reference Media</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMedia.isPending}
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
                this character should look.
              </p>

              {character.media && character.media.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {character.media.map((media) => (
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
                    No reference media uploaded yet
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateCharacter.isPending}>
              {updateCharacter.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
