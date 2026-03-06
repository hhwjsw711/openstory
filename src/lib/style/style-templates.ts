import { getEnv } from '#env';
import type { Style } from '@/types/database';

/**
 * Get the R2 public assets domain from environment
 */
function getPublicAssetsDomain(): string {
  return getEnv().R2_PUBLIC_ASSETS_DOMAIN ?? '';
}

/**
 * Generate preview URL for a style
 */
function getStylePreviewUrl(styleName: string): string {
  const sanitized = styleName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `https://${getPublicAssetsDomain()}/styles/${sanitized}/thumbnail.webp`;
}

// Default style templates that can be imported into any team
export const DEFAULT_STYLE_TEMPLATES: Array<
  Omit<Style, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'createdBy'>
> = [
  {
    name: 'Product Ad',
    description:
      'Fresh, tactile product content with lifestyle context and sensory detail. Designed for Instagram, DTC brands, e-commerce, and social-first campaigns.',
    category: 'ecommerce',
    tags: ['ecommerce', 'product', 'instagram', 'dtc', 'lifestyle', 'social'],
    config: {
      mood: 'Fresh, sensory, and effortlessly cool',
      artStyle:
        'Modern social-first product photography with tactile, editorial energy. Products shown in real-life context -- hands opening packaging, fingers pressing textures, products on bathroom shelves, kitchen counters, rumpled linen. Close-up detail shots emphasize material and finish. Flat-lays with curated minimal arrangements. Color-matched backgrounds that complement the product. Every frame feels like something you would screenshot and save',
      lighting:
        'Bright natural window light with clean directional shadows. Direct on-camera flash for punchy editorial energy on select shots. No heavy diffusion -- let light feel real and immediate. Golden hour warmth for lifestyle moments. High-key and airy overall with pops of contrast',
      colorPalette: ['#FFFFFF', '#F0E6D3', '#D4536D', '#1A1A1A', '#E8F4E8'],
      cameraWork:
        'Dynamic mix of handheld and locked shots with consistent energy. Handheld with natural micro-movement for lifestyle moments -- hands interacting, daily rituals, real context. Quick-cut to locked beauty frames for hero product shots. Macro details on textures and surfaces. Overhead flat-lays directly above. Eye-level and slightly above angles. Shallow depth of field on tactile details. Energetic pacing -- no lingering, every frame earns its time',
      referenceFilms: [
        'Rhode Skin Instagram',
        'Glossier Visual Identity',
        'Summer Fridays Campaigns',
        'Drunk Elephant Content',
      ],
      colorGrading:
        'Clean and bright with true-to-life color. Whites are crisp, skin tones warm and natural. Minimal processing -- the product looks like it does in your hand. Slight warmth in highlights, lifted shadows keeping everything airy. One accent color pops against neutral base',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Product Ad'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Real Estate',
    description:
      'Prestige property cinematography with golden-hour warmth and aspirational lifestyle framing. Glamorous figures inhabit sun-drenched interiors, adding warmth and scale to luxury spaces. Designed for high-end real estate branding, lifestyle property films, and luxury development showcases.',
    category: 'realestate',
    tags: [
      'real-estate',
      'property',
      'luxury',
      'lifestyle',
      'prestige',
      'interior-design',
    ],
    config: {
      mood: 'Luxurious, aspirational, and effortlessly glamorous',
      artStyle:
        'Prestige property cinematography with editorial lifestyle sensibility. Luxury interiors shot with depth and grandeur -- marble surfaces, floor-to-ceiling windows, curated furnishings. Elegant women in designer loungewear or evening attire occupy the spaces naturally -- reading on a linen sofa, pouring wine at a kitchen island, silhouetted against a sunset terrace. The architecture dominates every frame while human presence adds warmth, scale, and aspiration. Compositions emphasize clean sight lines, spatial depth, and the interplay of golden light with rich materials',
      lighting:
        'Late afternoon golden hour streaming through expansive windows, casting long warm beams across polished floors and textured surfaces. Rim light catching hair and shoulders of figures in the space. Balanced ambient fill preserving detail in corners and alcoves. Interior spaces glow with warm artificial accents -- table lamps, pendant fixtures -- blending seamlessly with fading daylight',
      colorPalette: ['#F5EDE3', '#C9A96E', '#6B4C3B', '#E8D5C4', '#2C2420'],
      cameraWork:
        'Slow, cinematic dolly movements through grand interiors at eye level. Smooth reveals through doorways framing figures in the distance. Wide establishing shots of exteriors at golden hour, intimate medium shots of lifestyle moments. Shallow depth of field isolating textures and details -- a hand on a marble countertop, light catching crystal glassware. Symmetrical compositions for architectural grandeur, rule-of-thirds for lifestyle vignettes',
      referenceFilms: [
        "Sotheby's International Realty Brand Films",
        'Tom Ford A Single Man Interiors',
        'Succession HBO Cinematography',
        'The Great Gatsby Production Design',
      ],
      colorGrading:
        'Warm and luminous with rich golden highlights and creamy skin tones. Lifted shadows keeping interiors airy and inviting. Subtle amber shift throughout, with deep walnut tones in shadows. Skin rendered with warmth and softness. Overall palette feels like late-afternoon sun on travertine',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Real Estate'),
    version: null,
    usageCount: null,
  },
  {
    name: 'YouTube',
    description:
      'Energetic, personality-driven visuals with punchy colors and direct-to-camera framing. Built for YouTube content, vlogs, podcast clips, and creator-led explainers.',
    category: 'youtube',
    tags: [
      'youtube',
      'creator',
      'vlog',
      'podcast',
      'explainer',
      'talking-head',
    ],
    config: {
      mood: 'Energetic, approachable, and confident',
      artStyle:
        'Modern digital content creator aesthetic. Clean background environments with personality -- RGB accent lighting, styled bookshelves, or minimal desk setups. Subject is always the focal point with direct eye contact to camera. Punchy, scroll-stopping visual energy',
      lighting:
        'Three-point key light setup with strong key, soft fill, and colored RGB rim/backlight for depth. High-key on subject face for clarity. Background slightly darker to create depth separation. Clean, modern, studio-grade illumination',
      colorPalette: ['#FF4D4D', '#1E1E2E', '#00D4FF', '#FFFFFF', '#FFB800'],
      cameraWork:
        'Locked medium close-up for talking head, occasional slow push-in for emphasis. Cut-away wide shots of workspace or B-roll. Direct-to-camera angle at eye level. Minimal movement -- stability and clarity prioritized over cinematic dynamism',
      referenceFilms: [
        'MKBHD Studio Setup',
        'Casey Neistat Visual Style',
        'Linus Tech Tips',
        'Ali Abdaal Content Aesthetic',
      ],
      colorGrading:
        'High contrast with vivid saturation. Skin tones warm and natural against cooler backgrounds. Blacks are deep, whites are clean. Slight teal-orange split for modern digital look',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('YouTube'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Corporate',
    description:
      'Clean, professional visuals with contemporary design sensibility. Ideal for company culture videos, SaaS product demos, training content, and corporate communications.',
    category: 'corporate',
    tags: ['corporate', 'saas', 'business', 'professional', 'training', 'tech'],
    config: {
      mood: 'Professional, innovative, and trustworthy',
      artStyle:
        'Contemporary corporate visual style with clean geometry and professional environments. Modern office spaces, collaborative workspaces, and technology-forward settings. People appear natural and engaged, not staged. Compositions are balanced and uncluttered with intentional use of negative space',
      lighting:
        'Bright, even overhead lighting typical of modern offices with large windows. Soft and clean with no dramatic shadows. Natural daylight supplemented by warm artificial ambiance. Flattering and professional without being clinical',
      colorPalette: ['#0066FF', '#F8F9FA', '#1A1A2E', '#00C853', '#6C757D'],
      cameraWork:
        'Smooth dolly or gimbal movements through workspace environments. Static or slow-push medium shots for interviews and presentations. Over-the-shoulder angles for screen and product demonstrations. Clean, corporate B-roll pacing',
      referenceFilms: [
        'Stripe Brand Films',
        'Notion Product Videos',
        'HubSpot Culture Videos',
        'Salesforce Dreamforce Keynotes',
      ],
      colorGrading:
        'Clean and modern with slight cool cast. Whites are bright and true, skin tones natural. Subtle blue tint in shadows for a tech-forward feel. Overall bright and airy with controlled, professional color rendering',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Corporate'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Award Season',
    description:
      'Deep, emotional storytelling with rich cinematography. Perfect for character-driven narratives.',
    category: 'cinematic',
    tags: ['drama', 'emotional', 'character-driven', 'cinematic'],
    config: {
      artStyle: 'Cinematic drama with deep shadows and warm tones',
      colorPalette: ['#8B4513', '#D2691E', '#F4A460', '#2F4F4F', '#708090'],
      lighting: 'Dramatic chiaroscuro lighting with strong contrast',
      cameraWork: 'Slow, deliberate movements with meaningful close-ups',
      mood: 'Introspective and emotional',
      referenceFilms: ['The Godfather', 'There Will Be Blood', 'Moonlight'],
      colorGrading: 'Warm highlights with cool shadows',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Award Season'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Documentary',
    description:
      'Natural, observational style with authentic lighting and handheld movement.',
    category: 'documentary',
    tags: ['documentary', 'realistic', 'natural', 'authentic', 'observational'],
    config: {
      artStyle: 'Natural documentary style with authentic environments',
      colorPalette: ['#8B7355', '#CD853F', '#DEB887', '#F5DEB3', '#FFE4B5'],
      lighting: 'Natural and available light only',
      cameraWork: 'Handheld camera with observational framing',
      mood: 'Authentic and immediate',
      referenceFilms: ['Free Solo', 'The Act of Killing', 'Citizenfour'],
      colorGrading: 'Natural color with slight desaturation',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Documentary'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Action',
    description:
      'High-energy visuals with dynamic camera work and explosive color palette.',
    category: 'action',
    tags: ['action', 'blockbuster', 'explosive', 'dynamic', 'adventure'],
    config: {
      artStyle: 'High-octane action with dynamic compositions',
      colorPalette: ['#FF4500', '#FFD700', '#1E90FF', '#FF6347', '#FFA500'],
      lighting: 'High contrast with dramatic rim lighting',
      cameraWork: 'Fast cuts, sweeping crane shots, and dynamic angles',
      mood: 'Exciting and adrenaline-pumping',
      referenceFilms: ['Mad Max: Fury Road', 'John Wick', 'Mission Impossible'],
      colorGrading: 'Saturated colors with orange and teal contrast',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Action'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Rom-Com',
    description:
      'Bright, warm visuals with soft lighting and cheerful compositions.',
    category: 'romance',
    tags: ['romance', 'comedy', 'lighthearted', 'warm', 'feelgood'],
    config: {
      artStyle: 'Warm and inviting with soft, romantic lighting',
      colorPalette: ['#FFC0CB', '#FFDAB9', '#FFE4E1', '#F0FFFF', '#FFFACD'],
      lighting: 'Soft, diffused lighting with warm tones',
      cameraWork: 'Smooth movements with intimate framing',
      mood: 'Light, romantic, and optimistic',
      referenceFilms: ['La La Land', 'Amelie', 'When Harry Met Sally'],
      colorGrading: 'Warm and saturated with soft contrast',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Rom-Com'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Animated',
    description:
      'Premium, adult-oriented animation with rich textures, painterly detail, and cinematic depth. Built for sophisticated storytelling, dark fantasy, sci-fi, and narrative-driven content.',
    category: 'animation',
    tags: [
      'animation',
      'sophisticated',
      'cinematic',
      'dark',
      'premium',
      'narrative',
    ],
    config: {
      artStyle:
        'High-fidelity stylized animation with painterly textures and hand-crafted detail. Environments are richly layered with depth and atmosphere -- decayed grandeur, neon-lit cityscapes, or lush otherworldly landscapes. Characters have grounded proportions with expressive, nuanced faces. Every frame composed like a standalone illustration',
      colorPalette: ['#1B1F3B', '#C9A227', '#8B2252', '#2E4045', '#D4A574'],
      lighting:
        'Dramatic volumetric lighting with god rays, atmospheric haze, and deep contrast. Motivated sources -- firelight, neon signage, bioluminescence -- casting colored shadows. Rim lighting separates characters from richly detailed backgrounds. Chiaroscuro for emotional weight',
      cameraWork:
        'Cinematic camera language -- slow tracking shots through detailed environments, dramatic rack focuses between foreground and background layers. Low angles for power, high angles for vulnerability. Long takes that let the world breathe, punctuated by sharp editorial cuts for impact',
      mood: 'Intense, layered, and emotionally complex',
      referenceFilms: [
        'Arcane',
        'Love Death + Robots',
        'Into the Spider-Verse',
        'Wolfwalkers',
      ],
      colorGrading:
        'Deep, moody palette with crushed blacks and selective saturation. Warm amber and gold for intimate scenes, cold steel blue for tension. Rich jewel tones used sparingly as accent. Overall filmic with subtle grain and texture overlay',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Animated'),
    version: null,
    usageCount: null,
  },
];

// System styles without teamId - teamId will be added during seeding
export const DEFAULT_SYSTEM_STYLES: Omit<Style, 'id' | 'teamId'>[] =
  DEFAULT_STYLE_TEMPLATES.map((style) => ({
    ...style,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  }));

// Mock styles for testing - includes mock IDs and teamId
export const MOCK_SYSTEM_STYLES: Style[] = DEFAULT_SYSTEM_STYLES.map(
  (style) => ({
    ...style,
    id: style.name.replace(/\s+/g, '-').toLowerCase(),
    teamId: 'mock-system-team-id', // Mock team ID for testing
  })
);
