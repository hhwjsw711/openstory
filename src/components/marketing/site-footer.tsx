import { OpenStoryLogo } from '@/components/icons/openstory-logo';
import { Button } from '@/components/ui/button';
import { FILMSTRIP_IMAGES } from '@/lib/marketing/constants';
import { Link } from '@tanstack/react-router';
import { Image } from '@unpic/react';

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
          </div>
        </div>
      </div>
    </footer>
  );
}
