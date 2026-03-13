import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HERO_IMAGES, SITE_CONFIG } from '@/lib/marketing/constants';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="px-6 pt-32 pb-0 sm:pt-40">
      <div className="mx-auto max-w-5xl text-center">
        <Badge
          variant="outline"
          className="mb-8 gap-2 rounded-full px-4 py-1.5 font-display text-[11px] tracking-[0.15em] uppercase"
        >
          <span className="inline-block size-1.5 rounded-full bg-[var(--color-violet)]" />
          Open Source AI Video Production
        </Badge>

        <h1 className="font-heading text-5xl font-bold tracking-tighter text-foreground leading-[1.05] sm:text-6xl md:text-7xl lg:text-[6.5rem]">
          Open Video Generation.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground font-body sm:text-xl md:text-2xl">
          {SITE_CONFIG.description}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/sequences/new">Get Started</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full px-8"
          >
            <a
              href={SITE_CONFIG.githubHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon className="size-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-[1400px] grid-cols-[1.4fr_1fr] grid-rows-2 gap-3 px-6 h-[clamp(320px,40vw,520px)] sm:mt-16 max-md:grid-cols-2 max-md:grid-rows-none max-md:h-auto max-sm:grid-cols-1">
        {HERO_IMAGES.map((img, i) => (
          <div
            key={img.src}
            className={`overflow-hidden rounded-2xl border border-border ${i === 0 ? 'row-span-2 max-md:row-span-1' : ''} ${i === 2 ? 'max-sm:hidden' : ''}`}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="eager"
              className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03]"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
