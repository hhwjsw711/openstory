import { OpenStoryLogo } from '@/components/icons/openstory-logo';
import { Button } from '@/components/ui/button';
import { SITE_CONFIG } from '@/lib/marketing/constants';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export const OgImage: React.FC = () => {
  return (
    <div className="relative flex h-[630px] w-[1200px] flex-col items-center justify-center overflow-hidden bg-black">
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

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <OpenStoryLogo className="mb-8 h-16 w-auto text-white" />

        <h1 className="font-heading text-[7rem] font-bold tracking-tighter leading-[0.95] text-white">
          Open Video
          <br />
          <span className="text-editorial">Generation.</span>
        </h1>

        <p className="mt-5 max-w-md text-xl text-white/70">
          {SITE_CONFIG.description}
        </p>

        <div className="mt-8 flex gap-3">
          <Button
            size="lg"
            className="rounded-full bg-white px-8 text-black hover:bg-white/90"
          >
            Get Started
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full border-white/25 bg-white/5 px-8 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white"
          >
            <GitHubIcon className="size-4" />
            View on GitHub
          </Button>
        </div>
      </div>
    </div>
  );
};
