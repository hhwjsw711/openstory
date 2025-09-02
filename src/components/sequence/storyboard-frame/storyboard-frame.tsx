import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import type { Frame } from "@/types/database";

interface StoryboardFrameProps {
  frame: Frame;
  selected?: boolean;
  disabled?: boolean;
  showOrder?: boolean;
  onSelect?: (frameId: string) => void;
  onEdit?: (frameId: string) => void;
  onDelete?: (frameId: string) => void;
  onReorder?: (frameId: string, newOrder: number) => void;
}

export const StoryboardFrame: React.FC<StoryboardFrameProps> = ({
  frame,
  selected = false,
  disabled = false,
  showOrder = true,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: frame.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border-2 bg-white shadow-sm transition-all ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
      } ${isDragging ? "opacity-50" : ""} ${disabled ? "opacity-50" : "hover:shadow-md"}`}
    >
      {/* Order indicator */}
      {showOrder && (
        <div
          className="absolute -top-2 -left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white cursor-grab"
          {...attributes}
          {...listeners}
        >
          {frame.order_index}
        </div>
      )}

      {/* Frame content */}
      <div className="aspect-video w-full overflow-hidden rounded-md">
        {frame.thumbnail_url ? (
          <Image
            src={frame.thumbnail_url}
            alt={`Frame ${frame.order_index} preview`}
            className="h-full w-full object-cover"
            width={1920}
            height={1080}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
            No preview available
          </div>
        )}
      </div>

      {/* Frame info */}
      <div className="p-3">
        <p className="text-sm text-gray-600 line-clamp-2">
          {frame.description}
        </p>
        {frame.duration_ms && (
          <p className="mt-1 text-xs text-gray-400">
            {(frame.duration_ms / 1000).toFixed(1)}s
          </p>
        )}
      </div>

      {/* Action buttons (shown on hover) */}
      {!disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(frame.id);
              }}
            >
              Edit
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(frame.id);
              }}
              variant="destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
