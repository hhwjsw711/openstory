import { OPEN_FAIR_BENEFITS } from '@/lib/marketing/constants';

export function OpenFairSection() {
  return (
    <section className="bg-muted px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Open &amp;&nbsp;Fair
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {OPEN_FAIR_BENEFITS.map((benefit) => (
            <div key={benefit.title} className="animate-on-scroll space-y-2">
              <h3 className="font-heading text-lg font-semibold text-foreground">
                {benefit.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
