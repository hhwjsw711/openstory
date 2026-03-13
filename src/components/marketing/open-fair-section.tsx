import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { OPEN_FAIR_BENEFITS } from '@/lib/marketing/constants';

export function OpenFairSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <div className="mb-10 text-center sm:mb-16">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Open &amp; Fair
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {OPEN_FAIR_BENEFITS.map((benefit) => (
          <Card
            key={benefit.title}
            className="transition-colors duration-300 hover:border-foreground/15"
          >
            <CardHeader>
              <div
                className="mb-3 h-1 w-10 rounded-full"
                style={{ backgroundColor: benefit.color }}
              />
              <CardTitle className="font-heading">{benefit.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed sm:text-base">
                {benefit.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
