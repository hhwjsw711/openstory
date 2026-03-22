export function ManifestoSection() {
  return (
    <section className="relative bg-foreground px-6 py-28 text-background md:py-40">
      {/* Vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.25) 100%)',
        }}
      />

      <div className="relative mx-auto max-w-[820px] text-center">
        <blockquote className="animate-on-scroll text-editorial text-[clamp(1.4rem,3.5vw,2.8rem)] leading-[1.45] text-background/90">
          &ldquo;Your idea is enough. OpenStory turns it into a full
          production&thinsp;&mdash;&thinsp;scenes, characters, shots,
          soundtrack. Start simple, go deep, build something nobody else could.
          Open source and endlessly customisable.&rdquo;
        </blockquote>
        <p className="mt-8 text-label text-background/35">
          Open Source &nbsp;&middot;&nbsp; Endlessly Customisable
          &nbsp;&middot;&nbsp; Yours to Own
        </p>
      </div>
    </section>
  );
}
