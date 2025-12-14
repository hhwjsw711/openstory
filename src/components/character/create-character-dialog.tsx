'use client';

import { useState } from 'react';
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
import { useCreateCharacter } from '@/hooks/use-characters';
import { Plus } from 'lucide-react';

type CreateCharacterDialogProps = {
  trigger?: React.ReactNode;
};

export const CreateCharacterDialog: React.FC<CreateCharacterDialogProps> = ({
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const createCharacter = useCreateCharacter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get('name');
    const descriptionValue = formData.get('description');

    const name = typeof nameValue === 'string' ? nameValue : '';
    const description =
      typeof descriptionValue === 'string' ? descriptionValue : '';

    if (!name.trim()) return;

    createCharacter.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        isHumanGenerated: true,
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Character
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Character</DialogTitle>
            <DialogDescription>
              Add a new character to your team's library for consistent
              AI-generated content.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Character name…"
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
                placeholder="Describe the character's appearance, personality, role…"
                rows={3}
              />
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
            <Button type="submit" disabled={createCharacter.isPending}>
              {createCharacter.isPending ? 'Creating…' : 'Create Character'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
