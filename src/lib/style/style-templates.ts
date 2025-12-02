import { Style } from '@/types/database';

/**
 * Get the R2 public assets domain from environment
 * Falls back to staging if not set
 */
function getPublicAssetsDomain(): string {
  const domain = process.env.R2_PUBLIC_ASSETS_DOMAIN ?? 'assets.velro.ai';
  return domain;
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
    name: 'Cinematic Drama',
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
    previewUrl: getStylePreviewUrl('Cinematic Drama'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Neo-Noir Thriller',
    description:
      'Dark, stylized visuals with high contrast and urban settings. Ideal for mystery and crime stories.',
    category: 'noir',
    tags: ['noir', 'thriller', 'urban', 'mystery', 'crime'],
    config: {
      artStyle: 'Neo-noir with stark contrasts and neon accents',
      colorPalette: ['#000000', '#FF0000', '#00CED1', '#4B0082', '#FF1493'],
      lighting: 'High contrast with venetian blind shadows and neon highlights',
      cameraWork: 'Dutch angles and voyeuristic framing',
      mood: 'Tense and mysterious',
      referenceFilms: ['Blade Runner', 'Sin City', 'Drive'],
      colorGrading: 'Desaturated with selective color pops',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Neo-Noir Thriller'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Wes Anderson Style',
    description:
      'Symmetrical compositions with pastel colors and whimsical aesthetics.',
    category: 'artistic',
    tags: ['whimsical', 'symmetrical', 'pastel', 'quirky', 'artistic'],
    config: {
      artStyle: 'Perfectly symmetrical compositions with pastel palette',
      colorPalette: ['#FFB6C1', '#87CEEB', '#F0E68C', '#DDA0DD', '#98FB98'],
      lighting: 'Soft, even lighting with minimal shadows',
      cameraWork:
        'Centered framing, tracking shots, and planimetric composition',
      mood: 'Whimsical and nostalgic',
      referenceFilms: [
        'Grand Budapest Hotel',
        'Moonrise Kingdom',
        'The Royal Tenenbaums',
      ],
      colorGrading: 'Saturated pastels with vintage feel',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Wes Anderson Style'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Documentary Realism',
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
    previewUrl: getStylePreviewUrl('Documentary Realism'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Sci-Fi Futuristic',
    description:
      'Clean, high-tech aesthetics with cool tones and sleek designs.',
    category: 'scifi',
    tags: ['scifi', 'futuristic', 'technology', 'space', 'cyberpunk'],
    config: {
      artStyle: 'Futuristic sci-fi with clean lines and holographic elements',
      colorPalette: ['#00FFFF', '#0000FF', '#C0C0C0', '#800080', '#00FF00'],
      lighting: 'Cool LED lighting with lens flares',
      cameraWork: 'Smooth camera movements with wide establishing shots',
      mood: 'Futuristic and technological',
      referenceFilms: ['Ex Machina', 'Arrival', 'Interstellar'],
      colorGrading: 'Cool blues and teals with high contrast',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Sci-Fi Futuristic'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Horror Gothic',
    description:
      'Dark, atmospheric visuals with Gothic elements and unsettling compositions.',
    category: 'horror',
    tags: ['horror', 'gothic', 'dark', 'atmospheric', 'supernatural'],
    config: {
      artStyle: 'Gothic horror with dark shadows and eerie atmosphere',
      colorPalette: ['#1C1C1C', '#8B0000', '#483D8B', '#2F4F4F', '#696969'],
      lighting: 'Low-key lighting with harsh shadows',
      cameraWork: 'Unsettling angles and slow zooms',
      mood: 'Ominous and foreboding',
      referenceFilms: ['The Witch', 'Hereditary', 'The Lighthouse'],
      colorGrading: 'Desaturated with crushed blacks',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Horror Gothic'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Action Blockbuster',
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
    previewUrl: getStylePreviewUrl('Action Blockbuster'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Romantic Comedy',
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
    previewUrl: getStylePreviewUrl('Romantic Comedy'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Western Epic',
    description:
      'Wide vistas with dusty, golden hour lighting and classic Western aesthetics.',
    category: 'western',
    tags: ['western', 'epic', 'frontier', 'classic', 'americana'],
    config: {
      artStyle: 'Classic Western with wide landscapes and golden hour lighting',
      colorPalette: ['#D2691E', '#8B4513', '#DEB887', '#CD853F', '#F4A460'],
      lighting: 'Magic hour lighting with long shadows',
      cameraWork: 'Wide shots, slow zooms, and classic Western framing',
      mood: 'Epic and frontier-inspired',
      referenceFilms: [
        'The Good, The Bad and The Ugly',
        'Once Upon a Time in the West',
        'The Searchers',
      ],
      colorGrading: 'Warm, dusty tones with high contrast',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Western Epic'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Animation Studio',
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
    previewUrl: getStylePreviewUrl('Animation Studio'),
    version: null,
    usageCount: null,
  },
  {
    name: 'Lo-Fi iPhone 7 Aesthetic (Clean)',
    description:
      'Simulates the look of circa-2016 smartphone photography without any overlays. Characterized by lower resolution, poor dynamic range (blown-out highlights), digital noise, and the specific "crunchy" JPEG processing of the iPhone 7 era.',
    category: 'photography',
    tags: ['lo-fi', 'iphone-7', 'amateur', '2010s', 'no-text', 'digital-noise'],
    config: {
      // ADDED EXPLICIT "NO TEXT" CONSTRAINTS HERE
      artStyle:
        'iPhone 7 12MP JPEG aesthetic. Clean image with absolutely NO text overlays, NO datestamps, and NO time indicators burnt into the visual. Visible digital compression artifacts and over-sharpening. Textures are slightly soft/muddy. Includes sensor limitations: significant digital noise in shadows and color fringing.',
      colorPalette: ['#F5F5DC', '#D2B48C', '#8B4513', '#FFFAF0', '#2F4F4F'],
      lighting:
        'Low dynamic range (LDR). Highlights are blown out/clipped (loss of detail in bright areas like skies or lamps). Shadows are crushed and grainy. Simulates the struggle of older sensors to balance exposure.',
      cameraWork:
        'Handheld amateur perspective, f/1.8 aperture. Less sophisticated stabilization implies slight micro-jitters. Focus is decent but not clinical; background separation is digital and less smooth than modern sensors.',
      mood: 'Nostalgic, amateur, "Camera Roll 2016". Authentic snapshot quality with no professional polish. Pure photographic capture.',
      // REMOVED 'Found Footage' and 'Snapchat' as they often trigger text overlays
      referenceFilms: [
        'Amateur Vlogs circa 2016',
        'Early Instagram Aesthetic',
        'Raw Phone Camera Roll',
      ],
      colorGrading:
        'Standard Rec.709 sRGB with older auto-white balance tendencies (often slightly too cool or too warm). No Log profile. Colors appear "baked in" and digital.',
    },
    isPublic: true,
    isTemplate: true,
    previewUrl: getStylePreviewUrl('Lo-Fi iPhone 7 Aesthetic Clean'),
    version: null,
    usageCount: null,
  },
];

// Slug for the system templates team
export const SYSTEM_TEAM_SLUG = 'system-templates';

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
