export function ProductShowcase() {
  return (
    <section className="bg-muted px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-label mb-6 text-center text-muted-foreground">
          The Interface
        </p>

        <div className="animate-on-scroll">
          {/* Browser frame */}
          <div className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="size-3 rounded-full bg-foreground/10" />
              <span className="size-3 rounded-full bg-foreground/10" />
              <span className="size-3 rounded-full bg-foreground/10" />
              <div className="ml-3 flex-1 rounded-md bg-muted px-3 py-1">
                <span className="text-xs text-muted-foreground">
                  app.openstory.so
                </span>
              </div>
            </div>

            {/* Screenshot placeholder — replace with real product screenshot */}
            <div className="flex aspect-video items-center justify-center bg-muted/50">
              <div className="text-center">
                <p className="text-muted-foreground/60 text-sm">
                  Product screenshot coming soon
                </p>
                <p className="text-muted-foreground/40 mt-1 text-xs">
                  Place screenshot at
                  assets.openstory.so/images/marketing/product-ui.webp
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
