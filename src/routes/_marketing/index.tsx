import { createFileRoute, redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import { HeroSection } from '@/components/marketing/hero-section';
import { ManifestoSection } from '@/components/marketing/manifesto-section';
import { SectionDivider } from '@/components/marketing/section-divider';
import { TopTierFeatures } from '@/components/marketing/feature-cards';
import { CapabilityGrid } from '@/components/marketing/capability-grid';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { OpenFairSection } from '@/components/marketing/open-fair-section';
import { FaqSection } from '@/components/marketing/faq-section';
import { SECTION_LABELS } from '@/lib/marketing/constants';

export const Route = createFileRoute('/_marketing/')({
  component: HomePage,
  beforeLoad: async ({ context }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session?.user) {
      throw redirect({ to: '/sequences/new' });
    }
  },
  head: () => ({
    meta: [
      { title: 'OpenStory \u2014 Open Source Script-to-Video' },
      {
        property: 'og:title',
        content: 'OpenStory \u2014 Open Source Script-to-Video',
      },
      {
        property: 'og:description',
        content:
          'Open source AI video generation. Script to video, multi-model AI, MIT licensed.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
    ],
  }),
});

function HomePage() {
  return (
    <main>
      <HeroSection />
      <SectionDivider label={SECTION_LABELS.intro} />
      <ManifestoSection />
      <SectionDivider label={SECTION_LABELS.openFair} />
      <OpenFairSection />
      <SectionDivider label={SECTION_LABELS.pipeline} />
      <TopTierFeatures />
      <SectionDivider label={SECTION_LABELS.toolkit} />
      <CapabilityGrid />
      <SectionDivider label={SECTION_LABELS.process} />
      <HowItWorks />
      <FaqSection />
    </main>
  );
}
