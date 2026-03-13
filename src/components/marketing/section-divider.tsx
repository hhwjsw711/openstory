import { Separator } from '@/components/ui/separator';

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <div className="flex items-center gap-6">
        <Separator className="flex-1" />
        <span className="whitespace-nowrap font-display text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
          {label}
        </span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
