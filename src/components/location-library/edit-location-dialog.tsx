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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useUpdateLibraryLocation,
  type LibraryLocationWithSheets,
} from '@/hooks/use-location-library';

type EditLocationDialogProps = {
  location: LibraryLocationWithSheets;
  trigger?: React.ReactNode;
};

export const EditLocationDialog: React.FC<EditLocationDialogProps> = ({
  location,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const updateLocation = useUpdateLibraryLocation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get('name');
    const descriptionValue = formData.get('description');

    const name = typeof nameValue === 'string' ? nameValue : '';
    const description =
      typeof descriptionValue === 'string' ? descriptionValue : '';

    if (!name.trim()) return;

    updateLocation.mutate(
      {
        locationId: location.id,
        name: name.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => setOpen(false),
      }
    );
  };

  const isPending = updateLocation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Update the location details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={location.name}
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={location.description ?? ''}
                placeholder="Describe the location's visual details…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
