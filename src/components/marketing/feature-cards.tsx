import { Image } from '@unpic/react';
import { TOP_TIER_FEATURES } from '@/lib/marketing/constants';

export function TopTierFeatures() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
      <div className="mb-16 sm:mb-20">
        <p className="text-label mb-4 text-[var(--color-violet)]">
          The Pipeline
        </p>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Everything you need to ship
        </h2>
      </div>

      <div className="space-y-32">
        {TOP_TIER_FEATURES.map((feature, i) => {
          const isReversed = i % 2 !== 0;
          const hasSplitMedia = 'images' in feature;

          return (
            <div
              key={feature.title}
              className="animate-on-scroll grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-20"
            >
              <div className={isReversed ? 'md:order-2' : ''}>
                {hasSplitMedia ? (
                  <div className="grid grid-rows-2 gap-3 h-[clamp(360px,45vw,600px)]">
                    {feature.images.map((src) => (
                      <div key={src} className="overflow-hidden rounded-2xl">
                        <Image
                          src={src}
                          alt={feature.title}
                          width={640}
                          height={300}
                          loading="lazy"
                          className="size-full object-cover transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-lg"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl h-[clamp(360px,45vw,600px)]">
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      width={640}
                      height={600}
                      loading="lazy"
                      className="size-full object-cover transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-lg"
                    />
                  </div>
                )}
              </div>

              <div className={`space-y-4 ${isReversed ? 'md:order-1' : ''}`}>
                <span className="text-label text-[var(--color-violet)]">
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
