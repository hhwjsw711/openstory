import { Link } from '@tanstack/react-router';
import { Image } from '@unpic/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HERO_FILMSTRIP, SITE_CONFIG } from '@/lib/marketing/constants';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const duplicatedFilmstrip = [...HERO_FILMSTRIP, ...HERO_FILMSTRIP];

export function HeroSection() {
  return (
    <section className="relative flex min-h-svh flex-col justify-end overflow-hidden bg-black">
      {/* Video background with static image poster fallback */}
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="size-full object-cover object-center"
        >
          <source
            src="https://assets.openstory.so/videos/hero-loop.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      {/* Gradient overlay: transparent top → dark bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />

      {/* Content positioned in lower portion */}
      <div className="relative z-10 px-6 pb-8 pt-32 sm:pb-12">
        <div className="mx-auto max-w-7xl">
          <Badge
            variant="outline"
            className="hero-reveal hero-reveal-delay-1 mb-6 gap-2 rounded-full border-white/20 bg-white/10 px-4 py-1.5 text-label text-white/80 backdrop-blur-sm sm:mb-8"
          >
            <span className="inline-block size-1.5 rounded-full bg-[var(--color-violet)]" />
            Open Source AI Video Production
          </Badge>

          <h1 className="hero-reveal hero-reveal-delay-2 font-heading text-6xl font-bold tracking-tighter leading-[0.95] text-white sm:text-7xl md:text-8xl lg:text-[8.5rem]">
            Open Video
            <br />
            <span className="text-editorial">Generation.</span>
          </h1>

          <p className="hero-reveal hero-reveal-delay-3 mt-5 max-w-md text-lg text-white/70 sm:text-xl md:mt-6 md:text-2xl">
            {SITE_CONFIG.description}
          </p>

          <div className="hero-reveal hero-reveal-delay-4 mt-8 flex flex-col gap-3 sm:flex-row sm:mt-10">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white px-8 text-black hover:bg-white/90"
            >
              <Link to="/sequences/new">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-white/25 bg-white/5 px-8 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white"
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

        {/* Mini filmstrip at bottom edge */}
        <div className="relative mx-auto mt-10 max-w-7xl overflow-hidden sm:mt-14">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black/80 to-transparent" />
          <div
            className="flex w-max gap-2 will-change-transform"
            style={{ animation: 'marquee 40s linear infinite' }}
          >
            {duplicatedFilmstrip.map((src, i) => (
              <Image
                key={`film-${i}-${src}`}
                src={src}
                alt=""
                width={142}
                height={80}
                loading="lazy"
                className="h-16 w-auto rounded-md opacity-40 sm:h-20"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
