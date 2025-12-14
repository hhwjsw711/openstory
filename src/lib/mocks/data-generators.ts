import type {
  Frame,
  Sequence,
  Style,
  Team,
  UserProfile,
} from '@/types/database';
import { faker } from '@faker-js/faker';

// Set consistent seed for reproducible mock data
faker.seed(123);

// Mock data generators
const generateMockSequence = (overrides?: Partial<Sequence>): Sequence => {
  const genres = [
    'Action',
    'Comedy',
    'Drama',
    'Horror',
    'Sci-Fi',
    'Documentary',
  ];
  const moods = [
    'Dramatic',
    'Upbeat',
    'Mysterious',
    'Romantic',
    'Intense',
    'Peaceful',
  ];
  const audiences = [
    'General',
    'Young Adult',
    'Children',
    'Professional',
    'Educational',
  ];

  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence(3).replace('.', ''),
    script: faker.lorem.paragraphs(3, '\n\n'),
    status: faker.helpers.arrayElement([
      'draft',
      'processing',
      'completed',
      'failed',
      'archived',
    ]),
    teamId: faker.string.uuid(),
    styleId: faker.string.uuid(),
    aspectRatio: faker.helpers.arrayElement(['16:9', '9:16', '1:1']),
    analysisModel: faker.helpers.arrayElement([
      'anthropic/claude-haiku-4.5',
      'anthropic/claude-sonnet-4.5',
    ]),
    analysisDurationMs: faker.number.int({ min: 1000, max: 15000 }), // 1-15 seconds
    imageModel: faker.helpers.arrayElement([
      'nano_banana_pro',
      'flux_schnell',
      'flux_pro',
    ]),
    videoModel: faker.helpers.arrayElement([
      'kling_v2_5_turbo_pro',
      'wan_i2v',
      'veo3_1',
    ]),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdBy: faker.string.uuid(),
    updatedBy: faker.string.uuid(),
    workflow: null,
    ...overrides,
  };
};

const generateMockFrame = (overrides?: Partial<Frame>): Frame => {
  const settings = [
    'City Street',
    'Forest',
    'Office',
    'Beach',
    'Mountains',
    'Space Station',
  ];
  const moods = ['Tense', 'Happy', 'Sad', 'Excited', 'Calm', 'Angry'];

  return {
    id: faker.string.uuid(),
    sequenceId: faker.string.uuid(),
    orderIndex: faker.number.int({ min: 1, max: 10 }),
    description: faker.lorem.paragraph(),
    thumbnailUrl: `https://picsum.photos/seed/${faker.helpers.arrayElement([
      '1478720568477-152d9b164e26', // Cinema scene
      '1485846234645-a62644f84728', // Film production
      '1524712245354-2c4e5e7121c0', // Cinematic landscape
      '1536098561742-ca998e48cbcc', // Action scene
      '1440404653325-ab127d49abc1', // Movie scene
      '1514565131-fce0801e5785', // City skyline
      '1506905925346-21bda4d32df4', // Mountain landscape
      '1507003211169-0a1dd7228f2d', // Portrait
    ])}/1920/1080`,
    thumbnailPath: `teams/${faker.string.uuid()}/sequences/${faker.string.uuid()}/frames/${faker.string.uuid()}/thumbnail.jpg`,
    variantImageUrl: null,
    variantImageStatus: 'pending',
    videoUrl: faker.datatype.boolean()
      ? `${faker.internet.url()}/video.mp4`
      : null,
    videoPath: faker.datatype.boolean()
      ? `teams/${faker.string.uuid()}/sequences/${faker.string.uuid()}/frames/${faker.string.uuid()}/motion.mp4`
      : null,
    durationMs: faker.number.int({ min: 3000, max: 10000 }),
    thumbnailStatus: faker.helpers.arrayElement([
      'pending',
      'generating',
      'completed',
      'failed',
    ]),
    thumbnailWorkflowRunId: faker.string.uuid(),
    thumbnailGeneratedAt: faker.date.recent(),
    thumbnailError: null,
    imageModel: faker.helpers.arrayElement([
      'flux_pro',
      'flux_dev',
      'nano_banana',
    ]),
    imagePrompt: null,
    videoStatus: faker.helpers.arrayElement([
      'pending',
      'generating',
      'completed',
      'failed',
    ]),
    motionPrompt: null,
    motionModel: faker.helpers.arrayElement([
      'veo3',
      'kling_v2_5_turbo_pro',
      'wan_i2v',
    ]),
    videoWorkflowRunId: faker.string.uuid(),
    videoGeneratedAt: faker.date.recent(),
    videoError: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    metadata: {
      sceneId: faker.string.uuid(),
      sceneNumber: faker.number.int({ min: 1, max: 20 }),
      originalScript: {
        extract: faker.lorem.paragraph(),
        lineNumber: faker.number.int({ min: 1, max: 100 }),
        dialogue: [],
      },
      metadata: {
        title: faker.lorem.words(3),
        durationSeconds: faker.number.int({ min: 2, max: 10 }),
        location: faker.helpers.arrayElement(settings),
        timeOfDay: faker.helpers.arrayElement([
          'morning',
          'afternoon',
          'evening',
          'night',
        ]),
        storyBeat: faker.lorem.sentence(),
      },
      selectedVariant: {
        cameraAngle: 'A1' as const,
        movementStyle: 'B1' as const,
        moodTreatment: 'C1' as const,
        rationale: faker.lorem.sentence(),
      },
      prompts: {
        visual: {
          fullPrompt: faker.lorem.paragraph(),
          negativePrompt: '',
          components: {
            sceneDescription: faker.lorem.sentence(),
            subject: faker.lorem.words(5),
            environment: faker.helpers.arrayElement(settings),
            lighting: faker.lorem.words(3),
            camera: faker.lorem.words(2),
            composition: faker.lorem.words(3),
            style: faker.lorem.word(),
            technical: faker.lorem.words(2),
            atmosphere: faker.helpers.arrayElement(moods),
          },
          parameters: {
            dimensions: {
              width: 1920,
              height: 1080,
              aspectRatio: '16:9',
            },
            quality: {
              steps: 30,
              guidance: 7.5,
            },
            control: {
              seed: null,
            },
          },
        },
        motion: {
          fullPrompt: faker.lorem.paragraph(),
          components: {
            cameraMovement: faker.lorem.words(3),
            startPosition: faker.lorem.words(2),
            endPosition: faker.lorem.words(2),
            durationSeconds: faker.number.int({ min: 2, max: 5 }),
            speed: 'medium',
            smoothness: 'smooth',
            subjectTracking: faker.lorem.word(),
            equipment: faker.lorem.word(),
          },
          parameters: {
            durationSeconds: faker.number.int({ min: 2, max: 5 }),
            fps: 24,
            motionAmount: 'medium' as const,
            cameraControl: {
              pan: 0,
              tilt: 0,
              zoom: 0,
              movement: 'steady',
            },
          },
        },
      },
    },
    ...overrides,
  };
};

const generateMockStyle = (overrides?: Partial<Style>): Style => {
  const artStyles = [
    'Photorealistic cinematic style',
    'Anime-inspired with vibrant colors',
    'Classic cartoon aesthetic',
    'Oil painting with rich textures',
    'Watercolor with soft edges',
    'Digital art with clean lines',
  ];
  const lightings = [
    'Natural sunlight with soft shadows',
    'Dramatic chiaroscuro lighting',
    'Soft diffused lighting',
    'High contrast with deep blacks',
    'Neon accent lighting with cool tones',
    'Golden hour magic lighting',
  ];
  const cameraWorks = [
    'Smooth tracking shots with steady cam',
    'Dynamic handheld camera movements',
    'Static shots with careful composition',
    'Sweeping crane shots with wide angles',
    'Intimate close-ups with shallow depth',
    'Dutch angles with unconventional framing',
  ];
  const moods = [
    'Dramatic and emotional',
    'Upbeat and energetic',
    'Mysterious and tense',
    'Romantic and warm',
    'Intense and thrilling',
    'Peaceful and serene',
  ];

  const colorGradings = [
    'Warm highlights with cool shadows',
    'Desaturated with selective color pops',
    'Saturated pastels with vintage feel',
    'Natural color with slight desaturation',
    'Cool blues and teals with high contrast',
    'Orange and teal contrast',
  ];

  return {
    id: faker.string.uuid(),
    name: faker.lorem.words(2),
    description: faker.lorem.sentence(),
    category: faker.helpers.arrayElement([
      'cinematic',
      'noir',
      'artistic',
      'documentary',
      'scifi',
      'horror',
      'action',
      'romance',
      'western',
      'animation',
    ]),
    tags: faker.helpers.arrayElements(
      [
        'dramatic',
        'emotional',
        'thriller',
        'urban',
        'whimsical',
        'realistic',
        'futuristic',
        'dark',
        'explosive',
        'lighthearted',
      ],
      { min: 2, max: 4 }
    ),
    previewUrl: faker.helpers.arrayElement([
      'https://picsum.photos/seed/1618005182384-a83a8bd57fbe/400/300',
      'https://picsum.photos/seed/1579783902614-a3fb3927b6a5/400/300',
      'https://picsum.photos/seed/1549490349-8643362247b5/400/300',
      'https://picsum.photos/seed/1604076913837-52ab5629fba9/400/300',
      'https://picsum.photos/seed/1557672172-298e090bd0f1/400/300',
      'https://picsum.photos/seed/1549887534-1541e9326642/400/300',
      'https://picsum.photos/seed/1567095761054-7a02e69e5c43/400/300',
      'https://picsum.photos/seed/1604871000636-074fa5117945/400/300',
      'https://picsum.photos/seed/1618005198919-d3d4b5a92ead/400/300',
      'https://picsum.photos/seed/1563089145-599997674d42/400/300',
      'https://picsum.photos/seed/1558591710-4b4a1ae0f04d/400/300',
      'https://picsum.photos/seed/1552083375-1447ce886485/400/300',
      'https://picsum.photos/seed/1579783928621-7a13d66a62d1/400/300',
      'https://picsum.photos/seed/1569163139394-de4798aa62b6/400/300',
      'https://picsum.photos/seed/1566041510394-cf7c8fe21800/400/300',
      'https://picsum.photos/seed/1557682250-33bd709cbe85/400/300',
    ]),
    config: {
      artStyle: faker.helpers.arrayElement(artStyles),
      colorPalette: faker.helpers.arrayElements(
        [
          '#FF6B6B',
          '#4ECDC4',
          '#45B7D1',
          '#96CEB4',
          '#FFEAA7',
          '#DDA0DD',
          '#98D8C8',
          '#F7DC6F',
          '#8B4513',
          '#D2691E',
          '#2F4F4F',
        ],
        { min: 3, max: 5 }
      ),
      lighting: faker.helpers.arrayElement(lightings),
      cameraWork: faker.helpers.arrayElement(cameraWorks),
      mood: faker.helpers.arrayElement(moods),
      referenceFilms: faker.helpers.arrayElements(
        [
          'Blade Runner',
          'The Godfather',
          'Grand Budapest Hotel',
          'Mad Max: Fury Road',
          'Moonlight',
          'Ex Machina',
          'The Witch',
          'La La Land',
        ],
        { min: 1, max: 3 }
      ),
      colorGrading: faker.helpers.arrayElement(colorGradings),
    },
    teamId: faker.string.uuid(),
    isPublic: faker.datatype.boolean(),
    isTemplate: faker.datatype.boolean(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdBy: faker.string.uuid(),
    usageCount: null,
    version: null,
    ...overrides,
  };
};

const generateMockTeam = (overrides?: Partial<Team>): Team => {
  const name = faker.company.name();
  return {
    id: faker.string.uuid(),
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
};

const generateMockUser = (overrides?: Partial<UserProfile>): UserProfile => {
  const fullName = faker.person.fullName();
  return {
    id: faker.string.uuid(),
    name: fullName,
    email: faker.internet.email(),
    emailVerified: faker.datatype.boolean(),
    image: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    fullName,
    avatarUrl: faker.image.avatar(),
    onboardingCompleted: null,
    accessCode: null,
    status: 'active' as const,
    ...overrides,
  };
};

// Utility functions for generating arrays
const generateMockSequences = (count: number = 5): Sequence[] => {
  return Array.from({ length: count }, () => generateMockSequence());
};

export const generateMockFrames = (
  count: number = 6,
  sequenceId?: string
): Frame[] => {
  return Array.from({ length: count }, (_, index) =>
    generateMockFrame({
      orderIndex: index + 1,
      ...(sequenceId && { sequenceId: sequenceId }),
    })
  );
};

export const generateMockStyles = (count: number = 8): Style[] => {
  return Array.from({ length: count }, () => generateMockStyle());
};

const generateMockTeams = (count: number = 3): Team[] => {
  return Array.from({ length: count }, () => generateMockTeam());
};

const generateMockUsers = (count: number = 5): UserProfile[] => {
  return Array.from({ length: count }, () => generateMockUser());
};
