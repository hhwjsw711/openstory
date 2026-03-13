import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FAQ_ITEMS } from '@/lib/marketing/constants';

export function FaqSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <div className="mb-10 sm:mb-16">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Frequently <span className="text-editorial">Asked</span>
        </h2>
      </div>

      <Accordion type="single" collapsible>
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border">
            <AccordionTrigger className="font-heading text-base font-medium text-foreground hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
