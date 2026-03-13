export const SITE_CONFIG = {
  name: 'OpenStory',
  description:
    'Multi-scene AI video production. Open source and free to self-host.',
  ctaText: 'Get Started',
  ctaHref: '/sequences/new',
  githubHref: 'https://github.com/openstory-so/openstory',
} as const;

export const HERO_IMAGES = [
  {
    src: '/images/marketing/13-scifi-chase.webp',
    alt: 'Sci-fi video generated with OpenStory',
  },
  {
    src: '/images/marketing/08-fashion-editorial.webp',
    alt: 'Fashion editorial content',
  },
  {
    src: '/images/marketing/09-music-video.webp',
    alt: 'Music video production',
  },
] as const;

export const TOP_TIER_FEATURES = [
  {
    title: 'From Idea to Finished Video',
    description:
      'Describe what you want in a line or paste a full script. OpenStory breaks it into scenes, generates shots, and scores the music. A complete production pipeline, not a single-shot toy.',
    image: '/images/marketing/03-real-estate-exterior.webp',
  },
  {
    title: 'Cast Your Own Talent & Locations',
    description:
      'Define your characters and environments once \u2014 age, wardrobe, lighting, architecture. OpenStory maintains consistency across every shot in every sequence.',
    images: [
      '/images/marketing/08-fashion-editorial.webp',
      '/images/marketing/07-food-restaurant.webp',
    ],
  },
  {
    title: 'Get The Shot You Want',
    description:
      'Generate variations of any shot \u2014 different angles, lighting, compositions \u2014 until it\u2019s exactly right. Creative direction, not creative compromise.',
    image: '/images/marketing/02-product-sneaker.webp',
  },
  {
    title: 'Take Your Work Anywhere',
    description:
      'Download individual shots, export full sequences, and get the prompts behind every generation. Your work isn\u2019t trapped here \u2014 use it in any editing tool or pipeline.',
    image: '/images/marketing/06-corporate-aerial.webp',
  },
] as const;

export const CAPABILITY_CARDS = [
  {
    title: 'Latest Models',
    description:
      'Access the best image and video models as they ship. Switch per shot, or let OpenStory pick.',
    image: '/images/marketing/02-product-sneaker.webp',
  },
  {
    title: 'Scenes & Shots',
    description:
      'Every sequence is broken into scenes, shots, and directions. Edit, reorder, or regenerate at any level.',
    image: '/images/marketing/04-real-estate-interior.webp',
  },
  {
    title: 'Consistent Worlds',
    description:
      'Characters and locations stay visually consistent across every frame, every scene.',
    image: '/images/marketing/09-music-video.webp',
  },
  {
    title: 'Music & Audio',
    description:
      'Generate music tracks and sound effects that match your sequence. Full audio composition built in.',
    image: '/images/marketing/07-food-restaurant.webp',
  },
  {
    title: 'Transparent Pricing',
    description:
      'No subscriptions. No markup on model costs. You pay what the AI providers charge\u2009\u2014\u2009nothing more.',
    image: '/images/marketing/06-corporate-aerial.webp',
  },
] as const;

export const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Describe Your Idea',
    description:
      'Start with a one-liner or a full script. OpenStory builds out scenes, assigns characters and locations, and prepares shot directions.',
  },
  {
    number: '02',
    title: 'Define Your Look',
    description:
      'Set your visual style, cast your talent, choose your locations. These carry across your entire project.',
  },
  {
    number: '03',
    title: 'Generate & Refine',
    description:
      'Generate AI frames for every shot. Swap models, try variations, regenerate until every shot is right.',
  },
  {
    number: '04',
    title: 'Export Everything',
    description:
      'Download shots, sequences, prompts, and music. Take it all into your editing tool of choice.',
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: 'What is OpenStory?',
    answer:
      'OpenStory is an open source AI video production platform. Describe an idea or paste a script, and it builds scenes, casts characters, generates shots, and scores music\u2009\u2014\u2009all from one interface. Multi-scene, fully exportable, and free to self-host.',
  },
  {
    question: 'Do I need to write a full script?',
    answer:
      'No. You can start with a single line and OpenStory will expand it into a full script with scenes, characters, and shot directions. Or paste in a complete script if you have one.',
  },
  {
    question: 'What AI models does it support?',
    answer:
      'OpenStory fully supports the latest image and video models as close to day zero as possible. You can switch models per shot or let OpenStory pick the best one.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'There are no subscriptions and no margin on model costs. You pay exactly what the AI providers charge\u2009\u2014\u2009nothing more. Bring your own API keys or self-host for full control.',
  },
  {
    question: 'Can I use my own API keys?',
    answer:
      'Absolutely. You can enter your own API keys directly\u2009\u2014\u2009no self-hosting required. Pay providers directly with full control over costs and usage.',
  },
  {
    question: 'Is it open source?',
    answer:
      'Yes. MIT licensed, full source on GitHub. You can self-host it, fork it, or use the managed cloud version.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Sign up to start immediately, or clone the GitHub repo to self-host. Describe your idea, define your look, and generate your first storyboard in minutes.',
  },
] as const;

export const OPEN_FAIR_BENEFITS = [
  {
    title: 'Open Source',
    description:
      'MIT licensed, full source on GitHub. Fork it, self-host it, or build entirely new workflows on top.',
    color: 'var(--color-violet)',
  },
  {
    title: 'Bring Your Own Keys',
    description:
      'Use your own API keys or self-host entirely. Pay providers directly, no markup.',
    color: 'var(--color-coral)',
  },
  {
    title: 'At Cost Pricing',
    description:
      'No subscriptions. No margin on model costs. You pay what the AI providers charge.',
    color: 'var(--color-peach)',
  },
  {
    title: 'Export Everything',
    description:
      'Shots, sequences, prompts, and music. Your work isn\u2019t trapped\u2009\u2014\u2009take it anywhere.',
    color: 'var(--foreground)',
  },
] as const;

export const FILMSTRIP_IMAGES = [
  '/images/marketing/01-product-cosmetics.webp',
  '/images/marketing/02-product-sneaker.webp',
  '/images/marketing/03-real-estate-exterior.webp',
  '/images/marketing/04-real-estate-interior.webp',
  '/images/marketing/05-corporate-team.webp',
  '/images/marketing/06-corporate-aerial.webp',
  '/images/marketing/07-food-restaurant.webp',
  '/images/marketing/08-fashion-editorial.webp',
  '/images/marketing/09-music-video.webp',
  '/images/marketing/10-youtube-creator.webp',
  '/images/marketing/11-startup-pitch.webp',
  '/images/marketing/12-travel-adventure.webp',
  '/images/marketing/13-scifi-chase.webp',
  '/images/marketing/14-fantasy-dragon.webp',
] as const;

export const SECTION_LABELS = {
  intro: 'OpenStory / 2026',
  pipeline: 'Chapter I: The Pipeline',
  toolkit: 'The Toolkit',
  process: 'The Process',
  openFair: 'Open & Fair',
} as const;

export const FOOTER_LINKS = {
  product: {
    title: 'Product',
    links: [
      { label: 'How it Works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '/credits' },
    ],
  },
  openSource: {
    title: 'Open Source',
    links: [
      { label: 'GitHub', href: 'https://github.com/openstory-so/openstory' },
      {
        label: 'MIT License',
        href: 'https://github.com/openstory-so/openstory/blob/main/LICENSE',
      },
      {
        label: 'Contributing',
        href: 'https://github.com/openstory-so/openstory/blob/main/CONTRIBUTING.md',
      },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
} as const;
