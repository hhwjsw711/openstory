const VITE_R2_PUBLIC_ASSETS_DOMAIN =
  import.meta.env.VITE_R2_PUBLIC_ASSETS_DOMAIN || 'assets.openstory.so';

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
                  openstory.so
                </span>
              </div>
            </div>

            <img
              src={`https://${VITE_R2_PUBLIC_ASSETS_DOMAIN}/images/marketing/product-ui.webp`}
              alt="OpenStory sequence editor showing scenes, frames, and AI-generated visuals"
              className="aspect-video w-full object-cover object-top"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
