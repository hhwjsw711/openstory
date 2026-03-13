import { Card } from '@/components/ui/card';
import { PROCESS_STEPS } from '@/lib/marketing/constants';

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-7xl px-6 py-16 sm:py-24"
    >
      <div className="mb-10 text-center sm:mb-16">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Four Steps to Your First Cut
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROCESS_STEPS.map((step) => (
          <Card
            key={step.number}
            className="p-8 transition-colors duration-300 hover:border-foreground/15"
          >
            <p
              className="mb-5 font-heading text-5xl font-bold leading-none"
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
            <h3 className="mb-3 font-heading text-lg font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
