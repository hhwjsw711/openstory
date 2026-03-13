import { PROCESS_STEPS } from '@/lib/marketing/constants';

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-4xl px-6 py-20 sm:py-28"
    >
      <div className="mb-12 sm:mb-16">
        <p className="text-label mb-4 text-muted-foreground">The Process</p>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Four Steps to Your First&nbsp;Cut
        </h2>
      </div>

      <div className="relative border-l-2 border-border pl-8 sm:pl-12">
        {PROCESS_STEPS.map((step, i) => (
          <div
            key={step.number}
            className={`animate-on-scroll relative ${i < PROCESS_STEPS.length - 1 ? 'pb-12 sm:pb-16' : ''}`}
          >
            {/* Connector dot */}
            <div className="absolute -left-[calc(2rem+5px)] top-1 size-2.5 rounded-full bg-border sm:-left-[calc(3rem+5px)]" />

            <div className="flex items-start gap-6 sm:gap-8">
              <p
                className="shrink-0 font-heading text-5xl font-bold leading-none sm:text-6xl"
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-violet), var(--color-coral))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {step.number}
              </p>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground sm:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
