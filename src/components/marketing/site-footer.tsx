import { Link } from '@tanstack/react-router';
import { Image } from '@unpic/react';
import { Button } from '@/components/ui/button';
import { OpenStoryLogo } from '@/components/icons/openstory-logo';
import { FILMSTRIP_IMAGES, SITE_CONFIG } from '@/lib/marketing/constants';

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const duplicatedFilmstrip = [...FILMSTRIP_IMAGES, ...FILMSTRIP_IMAGES].map(
  (src, idx) => ({ src, id: `film-${idx}` })
);

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-foreground text-background sm:mt-24">
      {/* CTA section */}
      <div className="mx-auto max-w-7xl px-6 pt-20 text-center sm:pt-28">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-background md:text-4xl lg:text-5xl">
          Ready to create?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-background/60 sm:text-lg">
          Start with an idea. Ship a finished video.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 rounded-full bg-background px-8 text-foreground hover:bg-background/90"
        >
          <Link to="/sequences/new">Get Started</Link>
        </Button>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-16 pb-0 sm:pt-20">
        <OpenStoryLogo size="lg" className="text-background" />
      </div>

      {/* Filmstrip */}
      <div className="relative mx-auto mt-16 max-w-7xl overflow-hidden border-t border-background/[0.08] py-8">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-foreground to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-foreground to-transparent" />
        <div
          className="flex w-max gap-3 will-change-transform"
          style={{ animation: 'marquee 45s linear infinite' }}
        >
          {duplicatedFilmstrip.map(({ src, id }) => (
            <Image
              key={id}
              src={src}
              alt=""
              width={228}
              height={160}
              loading="lazy"
              className="aspect-video h-32 w-auto rounded-lg opacity-60 transition-opacity duration-300 hover:opacity-100 sm:h-40"
            />
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto max-w-7xl border-t border-background/[0.08] px-6">
        <div className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-label text-background/25">
            &copy; {new Date().getFullYear()} OpenStory. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="text-xs text-background/40 transition-colors hover:text-background"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="text-xs text-background/40 transition-colors hover:text-background"
            >
              Privacy
            </Link>
            <a
              href="https://twitter.com/openstory"
              target="_blank"
              rel="noopener noreferrer"
              className="text-background/40 transition-colors hover:text-background"
              aria-label="Twitter"
            >
              <TwitterIcon />
            </a>
            <a
              href="https://youtube.com/@openstory"
              target="_blank"
              rel="noopener noreferrer"
              className="text-background/40 transition-colors hover:text-background"
              aria-label="YouTube"
            >
              <YouTubeIcon />
            </a>
            <a
              href={SITE_CONFIG.githubHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-background/40 transition-colors hover:text-background"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
