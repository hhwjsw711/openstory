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
export const generateMockSequence = (
  overrides?: Partial<Sequence>
): Sequence => {
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
    styleId: faker.datatype.boolean() ? faker.string.uuid() : null,
    analysisModel: faker.helpers.arrayElement([
      'anthropic/claude-haiku-4.5',
      'anthropic/claude-sonnet-4.5',
    ]),
    analysisDurationMs: faker.number.int({ min: 1000, max: 15000 }), // 1-15 seconds
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdBy: faker.string.uuid(),
    updatedBy: faker.string.uuid(),
    retryAttempt: 0,
    metadata: {
      genre: faker.helpers.arrayElement(genres),
      mood: faker.helpers.arrayElement(moods),
      targetAudience: faker.helpers.arrayElement(audiences),
    },
    ...overrides,
  };
};

export const generateMockFrame = (overrides?: Partial<Frame>): Frame => {
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
    videoUrl: faker.datatype.boolean()
      ? `${faker.internet.url()}/video.mp4`
      : null,
    durationMs: faker.number.int({ min: 3000, max: 10000 }),
    thumbnailStatus: faker.helpers.arrayElement([
      'idle',
      'generating',
      'completed',
      'failed',
    ]),
    thumbnailWorkflowRunId: faker.string.uuid(),
    thumbnailGeneratedAt: faker.date.recent(),
    thumbnailError: null,
    videoStatus: faker.helpers.arrayElement([
      'idle',
      'generating',
      'completed',
      'failed',
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
    thumbnailRetryAttempt: 0,
    videoRetryAttempt: 0,
    ...overrides,
  };
};

export const generateMockStyle = (overrides?: Partial<Style>): Style => {
  const artStyles = [
    'Photorealistic',
    'Anime',
    'Cartoon',
    'Oil Painting',
    'Watercolor',
    'Digital Art',
  ];
  const lightings = [
    'Natural',
    'Dramatic',
    'Soft',
    'High Contrast',
    'Neon',
    'Golden Hour',
  ];
  const compositions = [
    'Wide Shot',
    'Close-up',
    'Medium Shot',
    "Bird's Eye",
    'Low Angle',
    'Dutch Angle',
  ];

  return {
    id: faker.string.uuid(),
    name: faker.lorem.words(2),
    previewUrl: faker.helpers.arrayElement([
      'https://picsum.photos/seed/1618005182384-a83a8bd57fbe/400/300', // Abstract gradient
      'https://picsum.photos/seed/1579783902614-a3fb3927b6a5/400/300', // Colorful art
      'https://picsum.photos/seed/1549490349-8643362247b5/400/300', // Neon lights
      'https://picsum.photos/seed/1604076913837-52ab5629fba9/400/300', // Abstract waves
      'https://picsum.photos/seed/1557672172-298e090bd0f1/400/300', // Watercolor splash
      'https://picsum.photos/seed/1549887534-1541e9326642/400/300', // Dark abstract
      'https://picsum.photos/seed/1567095761054-7a02e69e5c43/400/300', // Geometric abstract
      'https://picsum.photos/seed/1604871000636-074fa5117945/400/300', // Paint texture
      'https://picsum.photos/seed/1618005198919-d3d4b5a92ead/400/300', // Gradient mesh
      'https://picsum.photos/seed/1563089145-599997674d42/400/300', // Digital abstract
      'https://picsum.photos/seed/1558591710-4b4a1ae0f04d/400/300', // Smoke abstract
      'https://picsum.photos/seed/1552083375-1447ce886485/400/300', // Color gradient
      'https://picsum.photos/seed/1579783928621-7a13d66a62d1/400/300', // Paint strokes
      'https://picsum.photos/seed/1569163139394-de4798aa62b6/400/300', // Fluid art
      'https://picsum.photos/seed/1566041510394-cf7c8fe21800/400/300', // Marble texture
      'https://picsum.photos/seed/1557682250-33bd709cbe85/400/300', // Purple gradient
    ]),
    config: {
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
        ],
        { min: 3, max: 5 }
      ),
      artStyle: faker.helpers.arrayElement(artStyles),
      lighting: faker.helpers.arrayElement(lightings),
      composition: faker.helpers.arrayElement(compositions),
    },
    teamId: faker.string.uuid(),
    isPublic: faker.datatype.boolean(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdBy: faker.string.uuid(),
    category: null,
    description: null,
    isTemplate: null,
    parentId: null,
    tags: null,
    usageCount: null,
    version: null,
    ...overrides,
  };
};

export const generateMockTeam = (overrides?: Partial<Team>): Team => {
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

export const generateMockUser = (
  overrides?: Partial<UserProfile>
): UserProfile => {
  const fullName = faker.person.fullName();
  return {
    id: faker.string.uuid(),
    name: fullName,
    email: faker.internet.email(),
    emailVerified: faker.datatype.boolean(),
    image: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    isAnonymous: null,
    fullName,
    avatarUrl: faker.image.avatar(),
    onboardingCompleted: null,
    ...overrides,
  };
};

// Utility functions for generating arrays
export const generateMockSequences = (count: number = 5): Sequence[] => {
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

export const generateMockTeams = (count: number = 3): Team[] => {
  return Array.from({ length: count }, () => generateMockTeam());
};

export const generateMockUsers = (count: number = 5): UserProfile[] => {
  return Array.from({ length: count }, () => generateMockUser());
};
