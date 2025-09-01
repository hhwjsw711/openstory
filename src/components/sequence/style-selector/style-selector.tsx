import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Style } from "@/types/database";

interface StyleSelectorProps {
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
  styles: Style[];
  disabled?: boolean;
  loading?: boolean;
}

interface StyleCardProps {
  style: Style;
  selected: boolean;
  onSelect: (styleId: string) => void;
  disabled?: boolean;
}

const StyleCard: React.FC<StyleCardProps> = ({
  style,
  selected,
  onSelect,
  disabled = false,
}) => {
  const handleClick = React.useCallback(() => {
    if (!disabled) {
      onSelect(style.id);
    }
  }, [style.id, onSelect, disabled]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        selected && "ring-2 ring-primary ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      data-testid={`style-card-${style.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
            <img
              src={style.preview_url || ""}
              alt={`${style.name} style preview`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="font-medium text-sm line-clamp-1" title={style.name}>
              {style.name}
            </h3>

            {style.config_json &&
              typeof style.config_json === "object" &&
              "artStyle" in style.config_json && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {String(style.config_json.artStyle)}
                </p>
              )}

            {style.config_json &&
              typeof style.config_json === "object" &&
              "colorPalette" in style.config_json &&
              Array.isArray(style.config_json.colorPalette) && (
                <div className="flex gap-1 mt-1" data-testid="color-palette">
                  {style.config_json.colorPalette
                    .slice(0, 4)
                    .map((color: any, index: number) => (
                      <div
                        key={index}
                        className="w-3 h-3 rounded-full border border-border/20"
                        style={{ backgroundColor: String(color) }}
                        title={String(color)}
                      />
                    ))}
                  {style.config_json.colorPalette.length > 4 && (
                    <div className="flex items-center justify-center w-3 h-3 text-[8px] text-muted-foreground">
                      +{style.config_json.colorPalette.length - 4}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StyleCardSkeleton: React.FC = () => (
  <Card>
    <CardContent className="p-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-1 mt-1">
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="w-3 h-3 rounded-full" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyleId,
  onStyleSelect,
  styles,
  disabled = false,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <StyleCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (styles.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center"
        data-testid="empty-state"
      >
        <div className="rounded-full bg-muted p-6 mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">No styles available</h3>
        <p className="text-muted-foreground max-w-sm">
          There are currently no styles to choose from. Check back later or
          contact your team administrator.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      data-testid="styles-grid"
    >
      {styles.map((style) => (
        <StyleCard
          key={style.id}
          style={style}
          selected={selectedStyleId === style.id}
          onSelect={onStyleSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
};
