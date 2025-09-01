import { faker } from "@faker-js/faker";
import type { Frame, Job, Sequence, Style, Team, User } from "@/types/database";

// Set consistent seed for reproducible mock data
faker.seed(123);

// Mock data generators
export const generateMockSequence = (
  overrides?: Partial<Sequence>,
): Sequence => {
  const genres = [
    "Action",
    "Comedy",
    "Drama",
    "Horror",
    "Sci-Fi",
    "Documentary",
  ];
  const moods = [
    "Dramatic",
    "Upbeat",
    "Mysterious",
    "Romantic",
    "Intense",
    "Peaceful",
  ];
  const audiences = [
    "General",
    "Young Adult",
    "Children",
    "Professional",
    "Educational",
  ];

  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence(3).replace(".", ""),
    script: faker.lorem.paragraphs(3, "\n\n"),
    status: faker.helpers.arrayElement([
      "draft",
      "processing",
      "completed",
      "failed",
      "archived",
    ]),
    team_id: faker.string.uuid(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    created_by: faker.string.uuid(),
    updated_by: faker.string.uuid(),
    metadata: {
      genre: faker.helpers.arrayElement(genres),
      mood: faker.helpers.arrayElement(moods),
      targetAudience: faker.helpers.arrayElement(audiences),
    },
    ...overrides,
  };
};

export const generateMockFrame = (overrides?: Partial<Frame>): Frame => {
  const characters = ["Hero", "Villain", "Sidekick", "Narrator", "Crowd"];
  const settings = [
    "City Street",
    "Forest",
    "Office",
    "Beach",
    "Mountains",
    "Space Station",
  ];
  const moods = ["Tense", "Happy", "Sad", "Excited", "Calm", "Angry"];

  return {
    id: faker.string.uuid(),
    sequence_id: faker.string.uuid(),
    order_index: faker.number.int({ min: 1, max: 10 }),
    description: faker.lorem.paragraph(),
    thumbnail_url: faker.image.url({ width: 1920, height: 1080 }),
    video_url: faker.datatype.boolean()
      ? `${faker.internet.url()}/video.mp4`
      : null,
    duration_ms: faker.number.int({ min: 3000, max: 10000 }),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    metadata: {
      characters: faker.helpers.arrayElements(characters, { min: 1, max: 3 }),
      setting: faker.helpers.arrayElement(settings),
      mood: faker.helpers.arrayElement(moods),
    },
    ...overrides,
  };
};

export const generateMockStyle = (overrides?: Partial<Style>): Style => {
  const artStyles = [
    "Photorealistic",
    "Anime",
    "Cartoon",
    "Oil Painting",
    "Watercolor",
    "Digital Art",
  ];
  const lightings = [
    "Natural",
    "Dramatic",
    "Soft",
    "High Contrast",
    "Neon",
    "Golden Hour",
  ];
  const compositions = [
    "Wide Shot",
    "Close-up",
    "Medium Shot",
    "Bird's Eye",
    "Low Angle",
    "Dutch Angle",
  ];

  return {
    id: faker.string.uuid(),
    name: faker.lorem.words(2),
    preview_url: faker.image.url({ width: 400, height: 300 }),
    config_json: {
      colorPalette: faker.helpers.arrayElements(
        [
          "#FF6B6B",
          "#4ECDC4",
          "#45B7D1",
          "#96CEB4",
          "#FFEAA7",
          "#DDA0DD",
          "#98D8C8",
          "#F7DC6F",
        ],
        { min: 3, max: 5 },
      ),
      artStyle: faker.helpers.arrayElement(artStyles),
      lighting: faker.helpers.arrayElement(lightings),
      composition: faker.helpers.arrayElement(compositions),
    },
    team_id: faker.string.uuid(),
    is_public: faker.datatype.boolean(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    created_by: faker.string.uuid(),
    ...overrides,
  };
};

export const generateMockJob = (overrides?: Partial<Job>): Job => {
  return {
    id: faker.string.uuid(),
    type: faker.helpers.arrayElement([
      "script_analysis",
      "frame_generation",
      "motion_generation",
      "video_export",
    ]),
    status: faker.helpers.arrayElement([
      "queued",
      "running",
      "completed",
      "failed",
    ]),
    payload: {
      resourceId: faker.string.uuid(),
      resourceType: faker.helpers.arrayElement(["sequence", "frame"]),
    },
    result: null,
    error: faker.datatype.boolean() ? faker.lorem.sentence() : null,
    team_id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    started_at: faker.date.recent().toISOString(),
    completed_at: faker.datatype.boolean()
      ? faker.date.recent().toISOString()
      : null,
    ...overrides,
  };
};

export const generateMockTeam = (overrides?: Partial<Team>): Team => {
  const name = faker.company.name();
  return {
    id: faker.string.uuid(),
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
};

export const generateMockUser = (overrides?: Partial<User>): User => {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    full_name: faker.person.fullName(),
    avatar_url: faker.image.avatar(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
};

// Utility functions for generating arrays
export const generateMockSequences = (count: number = 5): Sequence[] => {
  return Array.from({ length: count }, () => generateMockSequence());
};

export const generateMockFrames = (
  count: number = 6,
  sequenceId?: string,
): Frame[] => {
  return Array.from({ length: count }, (_, index) =>
    generateMockFrame({
      order_index: index + 1,
      ...(sequenceId && { sequence_id: sequenceId }),
    }),
  );
};

export const generateMockStyles = (count: number = 8): Style[] => {
  return Array.from({ length: count }, () => generateMockStyle());
};

export const generateMockJobs = (count: number = 5): Job[] => {
  return Array.from({ length: count }, () => generateMockJob());
};

export const generateMockTeams = (count: number = 3): Team[] => {
  return Array.from({ length: count }, () => generateMockTeam());
};

export const generateMockUsers = (count: number = 5): User[] => {
  return Array.from({ length: count }, () => generateMockUser());
};
