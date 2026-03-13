import { Card, CardContent } from '@/components/ui/card';
import { CAPABILITY_CARDS } from '@/lib/marketing/constants';

export function CapabilityGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <div className="mb-10 text-center sm:mb-16">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Capabilities
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITY_CARDS.map((card) => (
          <Card
            key={card.title}
            className="overflow-hidden transition-all duration-300 hover:border-foreground/15 hover:shadow-sm"
          >
            <img
              src={card.image}
              alt={card.title}
              loading="lazy"
              className="h-40 w-full object-cover"
            />
            <CardContent className="p-6">
              <h3 className="font-heading text-lg font-semibold text-foreground">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
