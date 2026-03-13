import { TOP_TIER_FEATURES } from '@/lib/marketing/constants';

export function TopTierFeatures() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <div className="space-y-16 sm:space-y-24">
        {TOP_TIER_FEATURES.map((feature, i) => {
          const isReversed = i % 2 !== 0;
          const hasSplitMedia = 'images' in feature;

          return (
            <div
              key={feature.title}
              className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-20"
            >
              <div className={isReversed ? 'md:order-2' : ''}>
                {hasSplitMedia ? (
                  <div className="grid grid-rows-2 gap-3 h-[clamp(280px,30vw,420px)]">
                    {feature.images.map((src) => (
                      <div
                        key={src}
                        className="overflow-hidden rounded-2xl border border-border"
                      >
                        <img
                          src={src}
                          alt={feature.title}
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-border h-[clamp(280px,30vw,420px)]">
                    <img
                      src={feature.image}
                      alt={feature.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03]"
                    />
                  </div>
                )}
              </div>

              <div className={`space-y-4 ${isReversed ? 'md:order-1' : ''}`}>
                <span className="font-display text-[11px] tracking-[0.15em] uppercase text-[var(--color-violet)]">
                  SC. 0{i + 1}
                </span>
                <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground leading-[1.12] md:text-3xl lg:text-4xl">
                  {feature.title}
                </h3>
                <p className="max-w-[440px] text-base leading-relaxed text-muted-foreground md:text-lg">
                  {feature.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
