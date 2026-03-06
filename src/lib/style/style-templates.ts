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

  return `https://${getPublicAssetsDomain()}/styles/${sanitized}/character.jpg`;
}

// Default style templates that can be imported into any team
export const DEFAULT_STYLE_TEMPLATES: Array<
  Omit<Style, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'createdBy'>
> = [
  {
    name: 'Product Ad',
    description:
      'Polished commercial photography with clean compositions and aspirational lifestyle framing. Designed for product ads, brand campaigns, and e-commerce content.',
    category: 'ecommerce',
    tags: [
      'ecommerce',
      'product',
      'commercial',
      'brand',
      'lifestyle',
      'advertising',
    ],
    config: {
      mood: 'Aspirational, premium, and trustworthy',
      artStyle:
        'High-end commercial photography with clean, editorial compositions. Subjects framed against minimalist or aspirational lifestyle environments. Product-forward staging with intentional negative space and precise object placement',
      lighting:
        'Soft studio key light with subtle fill, clean catchlights. Controlled highlights to emphasize surfaces and textures. No harsh shadows -- diffused, wrap-around illumination with occasional rim accent for separation',
      colorPalette: ['#F5F0EB', '#2C2C2C', '#C9A96E', '#E8E0D5', '#1A1A2E'],
      cameraWork:
        'Locked-off tripod with precise framing. Slow push-ins on hero products, smooth orbital reveals. Medium close-ups for detail, wide shots for lifestyle context. Shallow depth of field to isolate subjects',
      referenceFilms: [
        'Apple Product Films',
        'Squarespace Brand Campaigns',
        'Nike Dream Crazy',
        'Glossier Visual Identity',
      ],
      colorGrading:
        'Clean and neutral with lifted shadows and creamy skin tones. Subtle warm shift in highlights, controlled saturation to keep colors true-to-product',
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
      'Architectural photography with golden-hour warmth and expansive compositions. Perfect for property tours, listing videos, and luxury real estate showcases.',
    category: 'realestate',
    tags: [
      'real-estate',
      'property',
      'architecture',
      'luxury',
      'interior-design',
      'walkthrough',
    ],
    config: {
      mood: 'Welcoming, sophisticated, and spacious',
      artStyle:
        'Architectural and interior photography with wide-angle perspectives. Emphasize spatial depth, clean sight lines, and the interplay of natural light with interior design. Rooms feel lived-in but immaculate, spaces feel expansive and inviting',
      lighting:
        'Golden hour sunlight streaming through large windows casting warm directional beams across surfaces. Balanced ambient fill preserving shadow detail in corners. Interior spaces glow with mixed warm artificial and natural daylight',
      colorPalette: ['#F7F3EE', '#8B7355', '#4A6741', '#D4C5B2', '#2B3A42'],
      cameraWork:
        'Slow, fluid Steadicam walk-throughs at eye level. Wide-angle establishing shots of exteriors, smooth dolly reveals through doorways and hallways. Static hero shots of key rooms with symmetrical or rule-of-thirds framing',
      referenceFilms: [
        'Architectural Digest Open Door Series',
        'Selling Sunset Cinematography',
        'Tom Ford A Single Man Interiors',
        'Dwell Magazine Films',
      ],
      colorGrading:
        'Warm and luminous with golden highlights and open shadows. Slight lift in blacks to keep interiors airy. Greens and earth tones slightly enhanced for landscaping and organic elements',
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
      'Vibrant, stylized visuals reminiscent of high-quality animation productions.',
    category: 'animation',
    tags: ['animation', 'cartoon', 'vibrant', 'stylized', 'family'],
    config: {
      artStyle: 'High-quality animation style with vibrant colors',
      colorPalette: ['#FF69B4', '#00CED1', '#FFD700', '#98FB98', '#DDA0DD'],
      lighting: 'Bright, even lighting with soft shadows',
      cameraWork: 'Dynamic camera movements with exaggerated perspectives',
      mood: 'Playful and imaginative',
      referenceFilms: ['Spider-Verse', 'Coco', 'How to Train Your Dragon'],
      colorGrading: 'Hyper-saturated with vibrant colors',
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
