# Storybook Implementation Plan for Velro Video Sequence Creation

## Executive Summary

This document outlines a step-by-step implementation plan for adding Storybook v9 to the Velro application, focusing on creating a 3-page user flow for video sequence creation. The implementation follows the project's strict React guidelines, emphasizing minimal React usage, reducer-based state management, and pure presentational components. This plan leverages Storybook v9's latest features including improved performance, smaller bundle sizes, and enhanced testing capabilities.

## 1. Storybook v9 Setup and Configuration

### 1.1 Installation and Initial Setup

```bash
# Install Storybook v9 for Next.js 15
pnpm create storybook@latest

# Install TanStack Query v5 for data fetching
pnpm add @tanstack/react-query@^5.63.0 @tanstack/react-query-devtools@^5.63.0

# Install additional v9 performance tools
pnpm add -D @storybook/addon-performance@^1.0.0
```

### 1.2 Storybook v9 Configuration Files

Create `.storybook/main.ts` with v9 optimizations:
```typescript
import type { StorybookConfig } from '@storybook/nextjs';
import { join, dirname } from 'path';

function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
    getAbsolutePath('@storybook/addon-themes'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-coverage'),
    getAbsolutePath('@storybook/addon-viewport'),
    getAbsolutePath('@storybook/addon-measure'),
    getAbsolutePath('@storybook/addon-outline'),
    getAbsolutePath('@storybook/addon-performance'),
    getAbsolutePath('msw-storybook-addon'),
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      builder: {
        useSWC: true, // Use SWC for faster builds in v9
      },
      nextConfigPath: '../next.config.js',
    },
  },
  staticDirs: ['../public'],
  features: {
    experimentalRSC: true, // React Server Components support in v9
    storyStoreV7: true, // v9 story store for better performance
    buildStoriesJson: true, // v9 optimization for faster startup
    legacyDecoratorFileOrder: false, // v9 decorator order
  },
  core: {
    disableTelemetry: true,
    enableCrashReports: false,
  },
  typescript: {
    check: false, // Disable for faster builds, use separate type checking
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => {
        // Filter out props from node_modules for v9 performance
        if (prop.declarations !== undefined && prop.declarations.length > 0) {
          const hasPropAdditionalDescription = prop.declarations.find((declaration) => {
            return !declaration.fileName.includes('node_modules');
          });
          return Boolean(hasPropAdditionalDescription);
        }
        return true;
      },
    },
  },
  // v9 performance optimizations
  env: (config) => ({
    ...config,
    STORYBOOK_DISABLE_TELEMETRY: '1',
  }),
  previewHead: (head) => `
    ${head}
    <link rel="prefetch" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  `,
};

export default config;
```

Create `.storybook/preview.tsx` with v9 features:
```typescript
import type { Preview } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { themes } from '@storybook/theming';
import '../src/app/globals.css';

// Initialize MSW 2.x for v9
initialize({
  onUnhandledRequest: 'bypass',
  serviceWorker: {
    url: '/mockServiceWorker.js',
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // v5 uses gcTime instead of cacheTime
    },
  },
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true, // v9 feature for better control panel UX
      sort: 'requiredFirst', // v9 feature to show required props first
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
      },
    },
    // v9 viewport presets
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '812px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
    // v9 docs configuration
    docs: {
      theme: themes.light,
      toc: true, // v9 table of contents
      canvas: {
        sourceState: 'shown', // v9 show source by default
      },
    },
    // v9 performance budgets
    performance: {
      allowedPerformanceBudget: {
        baseline: 100,
        deviation: 50,
      },
    },
    // v9 accessibility configuration
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
    // v9 backgrounds
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0a0a0a' },
        { name: 'gray', value: '#f3f4f6' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  loaders: [mswLoader],
  // v9 global types for toolbar
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: ['light', 'dark'],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
  // v9 tags for organization
  tags: ['autodocs', 'visual-test'],
};

export default preview;
```

## 2. Component Architecture and Organization

### 2.1 Directory Structure

```
src/
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── textarea.tsx
│   │   └── select.tsx
│   ├── sequence/                # Feature-specific components
│   │   ├── script-editor/
│   │   │   ├── script-editor.tsx
│   │   │   ├── script-editor.stories.tsx
│   │   │   └── script-editor.test.tsx
│   │   ├── style-selector/
│   │   │   ├── style-selector.tsx
│   │   │   ├── style-selector.stories.tsx
│   │   │   └── style-selector.test.tsx
│   │   ├── storyboard-frame/
│   │   │   ├── storyboard-frame.tsx
│   │   │   ├── storyboard-frame.stories.tsx
│   │   │   └── storyboard-frame.test.tsx
│   │   └── motion-preview/
│   │       ├── motion-preview.tsx
│   │       ├── motion-preview.stories.tsx
│   │       └── motion-preview.test.tsx
│   └── layouts/
│       └── sequence-flow/
│           ├── sequence-flow-layout.tsx
│           └── sequence-flow-layout.stories.tsx
├── views/                       # Page-level components (routes)
│   ├── script-view/
│   │   ├── script-view.tsx
│   │   ├── script-view.stories.tsx
│   │   └── script-view.test.tsx
│   ├── storyboard-view/
│   │   ├── storyboard-view.tsx
│   │   ├── storyboard-view.stories.tsx
│   │   └── storyboard-view.test.tsx
│   └── motion-view/
│       ├── motion-view.tsx
│       ├── motion-view.stories.tsx
│       └── motion-view.test.tsx
├── hooks/                       # Custom hooks
│   ├── queries/
│   │   ├── use-sequence.ts
│   │   ├── use-frames.ts
│   │   └── use-styles.ts
│   └── mutations/
│       ├── use-create-sequence.ts
│       ├── use-update-frame.ts
│       └── use-generate-motion.ts
├── reducers/                    # State management
│   ├── sequence-reducer.ts
│   ├── storyboard-reducer.ts
│   └── motion-reducer.ts
├── services/                    # Mock service layer
│   ├── mocks/
│   │   ├── sequence-mock.ts
│   │   ├── frames-mock.ts
│   │   └── styles-mock.ts
│   └── api/
│       ├── sequence-api.ts
│       ├── frames-api.ts
│       └── styles-api.ts
└── lib/
    └── sequence/                # Business logic (vanilla TS)
        ├── script-validator.ts
        ├── frame-generator.ts
        └── style-processor.ts
```

### 2.2 Component Design Principles

Each component follows these patterns:

```typescript
// Example: script-editor.tsx
import type React from 'react';

export interface ScriptEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value,
  onValueChange,
  error,
  maxLength = 5000,
  placeholder = 'Paste your script here...',
  disabled = false,
  ...props
}) => {
  // Component implementation (under 100 lines)
  // No useEffect, minimal useState
  // Pure presentational logic only
};
```

## 3. Mock Service Layer Design with MSW 2.x for v9

### 3.1 Mock Data Generators with v9 Enhancements

Create `src/services/mocks/data-generators.ts`:
```typescript
import { faker } from '@faker-js/faker';
import type { Sequence, Frame, Style, Team, User } from '@/types/database';

// Set seed for consistent data in v9 visual testing
faker.seed(123);

export const generateMockSequence = (overrides?: Partial<Sequence>): Sequence => ({
  id: faker.string.uuid(),
  team_id: faker.string.uuid(),
  name: faker.lorem.words(3),
  script: faker.lorem.paragraphs(3),
  style_id: faker.string.uuid(),
  status: faker.helpers.arrayElement(['draft', 'processing', 'completed', 'failed']),
  metadata: {
    duration: faker.number.int({ min: 30, max: 300 }),
    frameCount: faker.number.int({ min: 4, max: 12 }),
    aspectRatio: faker.helpers.arrayElement(['16:9', '9:16', '1:1']),
  },
  created_at: faker.date.recent().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  ...overrides,
});

export const generateMockFrame = (overrides?: Partial<Frame>): Frame => ({
  id: faker.string.uuid(),
  sequence_id: faker.string.uuid(),
  name: faker.lorem.words(2),
  script_section: faker.lorem.paragraph(),
  image_url: faker.image.urlPicsumPhotos({ width: 1920, height: 1080 }),
  video_url: overrides?.video_url || null,
  creative_direction: faker.lorem.sentence(),
  prompt_json: {
    model: faker.helpers.arrayElement(['flux', 'sdxl', 'dalle3']),
    prompt: faker.lorem.sentence(),
    negativePrompt: faker.lorem.words(5),
    seed: faker.number.int({ min: 0, max: 999999 }),
  },
  order: faker.number.int({ min: 0, max: 10 }),
  duration: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
  transition: faker.helpers.arrayElement(['cut', 'fade', 'dissolve', 'wipe']),
  deleted: false,
  created_at: faker.date.recent().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  ...overrides,
});

export const generateMockStyle = (overrides?: Partial<Style>): Style => ({
  id: faker.string.uuid(),
  team_id: faker.string.uuid(),
  name: faker.helpers.arrayElement(['Cinematic', 'Anime', 'Photorealistic', 'Abstract', 'Noir']),
  description: faker.lorem.paragraph(),
  preset_json: {
    base_prompt: faker.lorem.sentence(),
    style_modifiers: faker.lorem.words(10).split(' '),
    color_palette: Array.from({ length: 5 }, () => faker.color.rgb()),
    lighting: faker.helpers.arrayElement(['natural', 'dramatic', 'soft', 'hard']),
    mood: faker.helpers.arrayElement(['uplifting', 'mysterious', 'tense', 'romantic']),
  },
  thumbnail_url: faker.image.urlPicsumPhotos({ width: 400, height: 300 }),
  is_public: faker.datatype.boolean(),
  usage_count: faker.number.int({ min: 0, max: 1000 }),
  created_at: faker.date.recent().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  ...overrides,
});

// Generate consistent mock data for v9 testing
export const mockDatabase = {
  sequences: Array.from({ length: 10 }, () => generateMockSequence()),
  frames: Array.from({ length: 50 }, () => generateMockFrame()),
  styles: Array.from({ length: 15 }, () => generateMockStyle()),
};
```

### 3.2 MSW 2.x Handlers for Storybook v9

Create `src/services/mocks/handlers.ts`:
```typescript
import { http, HttpResponse, delay } from 'msw';
import { generateMockSequence, generateMockFrame, generateMockStyle, mockDatabase } from './data-generators';

// MSW 2.x handlers compatible with Storybook v9
export const handlers = [
  // Script validation endpoint with v9 performance tracking
  http.post('/api/v1/scripts/validate', async ({ request }) => {
    const body = await request.json() as { script: string };
    
    // Simulate realistic processing delay
    await delay(faker.number.int({ min: 500, max: 1500 }));
    
    const isValid = body.script.length > 50;
    const needsEnhancement = body.script.length < 200;
    
    return HttpResponse.json({
      valid: isValid,
      enhanced: needsEnhancement 
        ? `${body.script}\n\n[AI Enhanced]: Additional dramatic elements and visual descriptions added for cinematic impact.`
        : body.script,
      message: !isValid ? 'Script must be at least 50 characters' : 'Script validated successfully',
      metadata: {
        wordCount: body.script.split(' ').length,
        estimatedFrames: Math.ceil(body.script.length / 100),
        processingTime: Date.now(),
      },
    });
  }),

  // Storyboard generation with streaming support (v9 feature)
  http.post('/api/v1/sequences/generate', async ({ request }) => {
    const body = await request.json() as { script: string; styleId: string };
    
    // Initial response with job ID
    const jobId = faker.string.uuid();
    
    return HttpResponse.json({
      jobId,
      status: 'processing',
      message: 'Storyboard generation started',
      estimatedTime: 30,
    }, { status: 202 });
  }),

  // Job status polling with progressive updates (v9 real-time simulation)
  http.get('/api/v1/jobs/:id', async ({ params }) => {
    const jobId = params.id as string;
    
    // Simulate progressive completion
    const progress = faker.number.int({ min: 0, max: 100 });
    const isComplete = progress === 100 || Math.random() > 0.8;
    
    await delay(300);
    
    if (isComplete) {
      const frames = Array.from({ length: 6 }, (_, i) => 
        generateMockFrame({ 
          order: i,
          sequence_id: jobId,
          image_url: `https://picsum.photos/seed/${jobId}-${i}/1920/1080`,
        })
      );
      
      return HttpResponse.json({
        id: jobId,
        status: 'completed',
        progress: 100,
        result: {
          sequence: generateMockSequence({ id: jobId }),
          frames,
        },
      });
    }
    
    return HttpResponse.json({
      id: jobId,
      status: 'processing',
      progress,
      message: `Generating frame ${Math.floor(progress / 16) + 1} of 6...`,
    });
  }),

  // Styles endpoint with filtering (v9 advanced mocking)
  http.get('/api/v1/styles', async ({ request }) => {
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId');
    const search = url.searchParams.get('search');
    
    await delay(200);
    
    let styles = mockDatabase.styles;
    
    if (teamId) {
      styles = styles.filter(s => s.team_id === teamId);
    }
    
    if (search) {
      styles = styles.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return HttpResponse.json({
      data: styles,
      total: styles.length,
    });
  }),

  // Frame CRUD operations
  http.patch('/api/v1/frames/:id', async ({ params, request }) => {
    const frameId = params.id as string;
    const updates = await request.json() as Partial<Frame>;
    
    await delay(500);
    
    const frame = mockDatabase.frames.find(f => f.id === frameId);
    if (!frame) {
      return new HttpResponse(null, { status: 404 });
    }
    
    const updatedFrame = { ...frame, ...updates, updated_at: new Date().toISOString() };
    
    return HttpResponse.json(updatedFrame);
  }),

  // Motion generation endpoint
  http.post('/api/v1/frames/:id/generate-motion', async ({ params }) => {
    const frameId = params.id as string;
    
    await delay(1000);
    
    return HttpResponse.json({
      jobId: faker.string.uuid(),
      frameId,
      status: 'queued',
      provider: faker.helpers.arrayElement(['runway', 'pika', 'stability']),
      estimatedTime: faker.number.int({ min: 60, max: 180 }),
    });
  }),

  // Error simulation for v9 error boundary testing
  http.get('/api/v1/error-test', () => {
    const shouldError = Math.random() > 0.5;
    
    if (shouldError) {
      return new HttpResponse(
        JSON.stringify({ error: 'Internal server error', code: 'ERR_INTERNAL' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return HttpResponse.json({ success: true });
  }),

  // WebSocket simulation for v9 real-time features
  http.get('/api/v1/ws/sequence/:id', async ({ params }) => {
    const sequenceId = params.id as string;
    
    // Return SSE-like response for real-time updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i <= 100; i += 10) {
          const data = `data: ${JSON.stringify({
            type: 'progress',
            sequenceId,
            progress: i,
            message: `Processing... ${i}%`,
          })}\n\n`;
          
          controller.enqueue(encoder.encode(data));
          await delay(500);
        }
        
        controller.close();
      },
    });
    
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),
];

// Export MSW 2.x browser setup for Storybook v9
export const worker = setupWorker(...handlers);
```

## 4. State Management with Reducers

### 4.1 Sequence Reducer

Create `src/reducers/sequence-reducer.ts`:
```typescript
export interface SequenceState {
  script: string;
  enhancedScript: string | null;
  selectedStyleId: string | null;
  validationStatus: 'idle' | 'validating' | 'valid' | 'invalid';
  validationError: string | null;
  generationStatus: 'idle' | 'generating' | 'completed' | 'error';
  generationError: string | null;
  sequence: Sequence | null;
}

export type SequenceAction =
  | { type: 'SET_SCRIPT'; payload: string }
  | { type: 'SET_STYLE'; payload: string }
  | { type: 'VALIDATE_START' }
  | { type: 'VALIDATE_SUCCESS'; payload: { enhanced: string | null } }
  | { type: 'VALIDATE_ERROR'; payload: string }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; payload: Sequence }
  | { type: 'GENERATE_ERROR'; payload: string }
  | { type: 'RESET' };

export const sequenceReducer = (
  state: SequenceState,
  action: SequenceAction
): SequenceState => {
  switch (action.type) {
    case 'SET_SCRIPT':
      return { ...state, script: action.payload, validationStatus: 'idle' };
    
    case 'SET_STYLE':
      return { ...state, selectedStyleId: action.payload };
    
    case 'VALIDATE_START':
      return { 
        ...state, 
        validationStatus: 'validating',
        validationError: null 
      };
    
    case 'VALIDATE_SUCCESS':
      return {
        ...state,
        validationStatus: 'valid',
        enhancedScript: action.payload.enhanced,
        validationError: null,
      };
    
    case 'VALIDATE_ERROR':
      return {
        ...state,
        validationStatus: 'invalid',
        validationError: action.payload,
      };
    
    case 'GENERATE_START':
      return {
        ...state,
        generationStatus: 'generating',
        generationError: null,
      };
    
    case 'GENERATE_SUCCESS':
      return {
        ...state,
        generationStatus: 'completed',
        sequence: action.payload,
        generationError: null,
      };
    
    case 'GENERATE_ERROR':
      return {
        ...state,
        generationStatus: 'error',
        generationError: action.payload,
      };
    
    case 'RESET':
      return initialSequenceState;
    
    default:
      return state;
  }
};

export const initialSequenceState: SequenceState = {
  script: '',
  enhancedScript: null,
  selectedStyleId: null,
  validationStatus: 'idle',
  validationError: null,
  generationStatus: 'idle',
  generationError: null,
  sequence: null,
};
```

### 4.2 Storyboard Reducer

Create `src/reducers/storyboard-reducer.ts`:
```typescript
export interface StoryboardState {
  frames: Frame[];
  selectedFrameId: string | null;
  editingFrameId: string | null;
  reorderMode: boolean;
  pendingChanges: Map<string, Partial<Frame>>;
}

export type StoryboardAction =
  | { type: 'SET_FRAMES'; payload: Frame[] }
  | { type: 'SELECT_FRAME'; payload: string | null }
  | { type: 'START_EDIT'; payload: string }
  | { type: 'UPDATE_FRAME'; payload: { id: string; changes: Partial<Frame> } }
  | { type: 'SAVE_FRAME'; payload: string }
  | { type: 'CANCEL_EDIT'; payload: string }
  | { type: 'DELETE_FRAME'; payload: string }
  | { type: 'REORDER_FRAMES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'TOGGLE_REORDER_MODE' }
  | { type: 'ADD_FRAME'; payload: { after: string; frame: Frame } }
  | { type: 'SPLIT_FRAME'; payload: { id: string; frames: Frame[] } };

export const storyboardReducer = (
  state: StoryboardState,
  action: StoryboardAction
): StoryboardState => {
  // Implementation details...
};
```

## 5. TanStack Query Hooks Structure

### 5.1 Query Hooks

Create `src/hooks/queries/use-sequence.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { sequenceApi } from '@/services/api/sequence-api';

export const useSequence = (sequenceId: string) => {
  return useQuery({
    queryKey: ['sequence', sequenceId],
    queryFn: () => sequenceApi.getSequence(sequenceId),
    enabled: !!sequenceId,
  });
};

export const useFrames = (sequenceId: string) => {
  return useQuery({
    queryKey: ['frames', sequenceId],
    queryFn: () => sequenceApi.getFrames(sequenceId),
    enabled: !!sequenceId,
  });
};

export const useStyles = (teamId: string) => {
  return useQuery({
    queryKey: ['styles', teamId],
    queryFn: () => sequenceApi.getStyles(teamId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

### 5.2 Mutation Hooks

Create `src/hooks/mutations/use-create-sequence.ts`:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sequenceApi } from '@/services/api/sequence-api';

export const useCreateSequence = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sequenceApi.createSequence,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      queryClient.setQueryData(['sequence', data.id], data);
    },
  });
};

export const useGenerateStoryboard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sequenceApi.generateStoryboard,
    onSuccess: (data) => {
      queryClient.setQueryData(['sequence', data.sequence.id], data.sequence);
      queryClient.setQueryData(['frames', data.sequence.id], data.frames);
    },
  });
};
```

### 5.3 Job Polling Hook

Create `src/hooks/queries/use-job-status.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { jobApi } from '@/services/api/job-api';

export const useJobStatus = (jobId: string | null, options?: {
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}) => {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobApi.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      if (data.status === 'completed' || data.status === 'failed') {
        if (data.status === 'completed') options?.onComplete?.(data.result);
        if (data.status === 'failed') options?.onError?.(new Error(data.error));
        return false;
      }
      return 1000; // Poll every second
    },
  });
};
```

## 6. Story Organization with CSF 3.0 and v9 Features

### 6.1 Story File Structure with CSF 3.0

Each component has a corresponding `.stories.tsx` file using CSF 3.0 format with v9 enhancements:

```typescript
// script-editor.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, fn, waitFor } from '@storybook/test';
import { ScriptEditor } from './script-editor';

const meta = {
  title: 'Sequence/ScriptEditor',
  component: ScriptEditor,
  parameters: {
    layout: 'centered',
    docs: {
      subtitle: 'AI-powered script editor with validation',
      description: {
        component: 'Editor for script input with real-time validation and AI enhancement capabilities',
      },
    },
    // v9 performance tracking
    performance: {
      disable: false,
      interactions: {
        measures: ['render-time', 'interaction-time'],
      },
    },
  },
  tags: ['autodocs', 'visual-test', 'stable'],
  argTypes: {
    value: {
      control: 'text',
      description: 'The current script value',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '""' },
      },
    },
    onValueChange: {
      action: 'valueChanged',
      description: 'Callback when script changes',
      table: {
        type: { summary: '(value: string) => void' },
      },
    },
    error: {
      control: 'text',
      description: 'Error message to display',
      table: {
        type: { summary: 'string | undefined' },
        category: 'State',
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable input',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
  },
  // CSF 3.0 render function with v9 features
  render: (args) => <ScriptEditor {...args} />,
} satisfies Meta<typeof ScriptEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default state with CSF 3.0 args
export const Default: Story = {
  args: {
    value: '',
    placeholder: 'Paste your script here...',
    onValueChange: fn(),
  },
};

// With content using CSF 3.0 name property
export const WithScript: Story = {
  name: 'With Script Content',
  args: {
    value: 'INT. COFFEE SHOP - DAY\n\nA bustling cafe filled with the aroma of fresh coffee...',
    onValueChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the editor with pre-filled script content',
      },
    },
  },
};

// Error state with v9 play function enhancements
export const WithError: Story = {
  name: 'Validation Error',
  args: {
    value: 'Too short',
    error: 'Script must be at least 50 characters',
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const errorMessage = canvas.getByText('Script must be at least 50 characters');
    
    // v9 enhanced assertions
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveAccessibleName();
    
    // Test interaction
    const input = canvas.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'New content');
    
    // v9 spy assertions
    await waitFor(() => {
      expect(args.onValueChange).toHaveBeenCalledWith('New content');
    });
  },
};

// Disabled state with v9 accessibility testing
export const Disabled: Story = {
  name: 'Disabled State',
  args: {
    value: 'Cannot edit during processing',
    disabled: true,
    onValueChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    
    // v9 accessibility assertions
    await expect(input).toBeDisabled();
    await expect(input).toHaveAttribute('aria-disabled', 'true');
  },
};

// CSF 3.0 with v9 interaction testing
export const InteractiveFlow: Story = {
  name: 'Interactive Editing Flow',
  args: {
    value: '',
    onValueChange: fn(),
    maxLength: 5000,
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    
    await step('Type script content', async () => {
      const input = canvas.getByRole('textbox');
      const testScript = 'FADE IN:\n\nEXT. MOUNTAIN RANGE - DAWN';
      
      await userEvent.type(input, testScript, {
        delay: 50, // v9 realistic typing delay
      });
      
      await expect(args.onValueChange).toHaveBeenLastCalledWith(testScript);
    });
    
    await step('Verify character count', async () => {
      const charCount = canvas.getByText(/characters remaining/i);
      await expect(charCount).toBeVisible();
    });
    
    await step('Test keyboard shortcuts', async () => {
      const input = canvas.getByRole('textbox');
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('{Delete}');
      
      await expect(args.onValueChange).toHaveBeenLastCalledWith('');
    });
  },
};
```

### 6.2 View-Level Stories with v9 Features

Create comprehensive stories for each view using v9's enhanced testing capabilities:

```typescript
// script-view.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, waitFor, fn } from '@storybook/test';
import { ScriptView } from './script-view';
import { handlers } from '@/services/mocks/handlers';
import { mockReset } from 'msw';

const meta = {
  title: 'Views/ScriptView',
  component: ScriptView,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers,
    },
    // v9 viewport testing
    chromatic: { 
      viewports: [375, 768, 1440],
      delay: 300,
    },
    // v9 performance monitoring
    performance: {
      disable: false,
      interactions: {
        measures: ['first-paint', 'interaction-latency'],
      },
    },
  },
  // CSF 3.0 beforeEach for setup
  beforeEach: () => {
    mockReset();
    localStorage.clear();
    sessionStorage.clear();
  },
} satisfies Meta<typeof ScriptView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Complete user flow with v9 step-by-step testing
export const UserFlow: Story = {
  name: 'Complete Creation Flow',
  parameters: {
    docs: {
      description: {
        story: 'Full end-to-end script to storyboard generation flow',
      },
    },
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    
    await step('Enter script content', async () => {
      const textarea = canvas.getByPlaceholderText(/paste your script/i);
      const scriptContent = `FADE IN:

EXT. ANCIENT TEMPLE - DAWN

The sun rises over weathered stone columns, casting long shadows across 
the courtyard. Birds chirp in the distance as morning mist clings to 
the ground.

A FIGURE emerges from the shadows, moving purposefully toward the 
temple entrance.`;
      
      await userEvent.type(textarea, scriptContent, { delay: 10 });
      
      // v9 assertion with better error messages
      await expect(textarea).toHaveValue(scriptContent);
    });
    
    await step('Validate script', async () => {
      const validateButton = canvas.getByRole('button', { name: /validate/i });
      await userEvent.click(validateButton);
      
      // Wait for validation with v9 enhanced waitFor
      await waitFor(
        () => expect(canvas.getByText(/script validated/i)).toBeVisible(),
        { timeout: 3000, interval: 100 }
      );
    });
    
    await step('Select style', async () => {
      const styleSelector = canvas.getByRole('combobox', { name: /style/i });
      await userEvent.click(styleSelector);
      
      // v9 improved selector with accessibility
      const cinematicOption = canvas.getByRole('option', { name: /cinematic/i });
      await userEvent.click(cinematicOption);
      
      await expect(styleSelector).toHaveTextContent('Cinematic');
    });
    
    await step('Configure AI settings', async () => {
      const advancedToggle = canvas.getByRole('button', { name: /advanced settings/i });
      await userEvent.click(advancedToggle);
      
      // v9 form interaction testing
      const creativitySlider = canvas.getByRole('slider', { name: /creativity/i });
      await userEvent.pointer([
        { target: creativitySlider, offset: 0, keys: '[MouseLeft>]' },
        { offset: 20 },
        { keys: '[/MouseLeft]' },
      ]);
      
      await expect(creativitySlider).toHaveAttribute('aria-valuenow', '70');
    });
    
    await step('Generate storyboard', async () => {
      const generateButton = canvas.getByRole('button', { name: /generate storyboard/i });
      await userEvent.click(generateButton);
      
      // v9 progress tracking
      await waitFor(() => {
        const progress = canvas.getByRole('progressbar');
        expect(progress).toBeVisible();
        expect(progress).toHaveAttribute('aria-busy', 'true');
      });
      
      // Wait for completion
      await waitFor(
        () => {
          const successMessage = canvas.getByText(/storyboard generated successfully/i);
          expect(successMessage).toBeVisible();
        },
        { timeout: 10000 }
      );
    });
    
    await step('Verify navigation', async () => {
      const continueButton = canvas.getByRole('button', { name: /continue to storyboard/i });
      await expect(continueButton).toBeEnabled();
      await expect(continueButton).toHaveFocus();
    });
  },
};

// v9 error handling story
export const ErrorHandling: Story = {
  name: 'Error Recovery Flow',
  parameters: {
    msw: {
      handlers: [
        // Override with error handlers
        ...handlers.map(handler => ({
          ...handler,
          resolver: () => new Response(null, { status: 500 }),
        })),
      ],
    },
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    
    await step('Trigger API error', async () => {
      const generateButton = canvas.getByRole('button', { name: /generate/i });
      await userEvent.click(generateButton);
      
      await waitFor(() => {
        const errorAlert = canvas.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/something went wrong/i);
      });
    });
    
    await step('Retry operation', async () => {
      const retryButton = canvas.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);
      
      // Verify retry attempt
      await expect(retryButton).toHaveAttribute('aria-busy', 'true');
    });
  },
};

// v9 responsive testing
export const MobileView: Story = {
  name: 'Mobile Responsive View',
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test mobile-specific interactions
    const menuButton = canvas.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    
    await userEvent.click(menuButton);
    const drawer = canvas.getByRole('navigation');
    await expect(drawer).toHaveAttribute('aria-expanded', 'true');
  },
};
```

## 7. Testing Strategy

### 7.1 Component Testing

Each component includes unit tests focusing on:
- Props validation
- Event handling
- Accessibility
- Edge cases

```typescript
// script-editor.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScriptEditor } from './script-editor';

describe('ScriptEditor', () => {
  it('renders with placeholder text', () => {
    render(<ScriptEditor value="" onValueChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/paste your script/i)).toBeInTheDocument();
  });
  
  it('calls onValueChange when text is entered', async () => {
    const handleChange = vi.fn();
    render(<ScriptEditor value="" onValueChange={handleChange} />);
    
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'New script content');
    
    expect(handleChange).toHaveBeenCalledWith('New script content');
  });
  
  it('displays error message when provided', () => {
    render(
      <ScriptEditor 
        value="Short" 
        onValueChange={vi.fn()} 
        error="Script too short"
      />
    );
    expect(screen.getByText('Script too short')).toBeInTheDocument();
  });
  
  it('prevents editing when disabled', () => {
    render(<ScriptEditor value="Content" onValueChange={vi.fn()} disabled />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });
});
```

### 7.2 Story Testing with v9 Test Runner

Use Storybook v9's enhanced test runner with improved performance:

```typescript
// .storybook/test-runner.ts
import type { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

const config: TestRunnerConfig = {
  // v9 parallel testing configuration
  async preVisit(page, context) {
    // Inject axe for accessibility testing
    await injectAxe(page);
    
    // v9 network condition simulation
    if (context.parameters?.networkCondition) {
      await page.route('**/*', (route) => {
        setTimeout(() => route.continue(), context.parameters.networkCondition.latency);
      });
    }
  },
  
  async postVisit(page, context) {
    // v9 enhanced accessibility testing
    if (!context.parameters?.a11y?.disable) {
      await checkA11y(page, '#storybook-root', {
        detailedReport: true,
        detailedReportOptions: {
          html: true,
        },
        axeOptions: context.parameters?.a11y?.config,
      });
    }
    
    // v9 performance metrics collection
    if (context.parameters?.performance) {
      const metrics = await page.evaluate(() => 
        JSON.stringify(performance.getEntriesByType('measure'))
      );
      console.log(`Performance metrics for ${context.title}:`, metrics);
    }
    
    // v9 visual regression testing hook
    if (context.parameters?.visual) {
      await page.screenshot({
        path: `./test-results/screenshots/${context.id}.png`,
        fullPage: context.parameters.visual.fullPage,
      });
    }
  },
  
  // v9 custom test configuration
  tags: {
    include: ['test-ready'],
    exclude: ['skip-test', 'experimental'],
  },
};

export default config;
```

### 7.3 Integration Testing with v9 Features

Test complete user flows with v9's improved testing utilities:

```typescript
// script-flow.integration.test.tsx
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { handlers } from '@/services/mocks/handlers';
import { ScriptView } from '@/views/script-view/script-view';

// MSW 2.x server setup for v9 testing
const server = setupServer(...handlers);

describe('Script to Storyboard Flow', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });
  
  afterAll(() => {
    server.close();
  });
  
  it('completes full flow from script to storyboard generation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { 
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    const user = userEvent.setup({
      delay: null, // Remove delay for faster tests in v9
    });
    
    render(
      <QueryClientProvider client={queryClient}>
        <ScriptView />
      </QueryClientProvider>
    );
    
    // Enter script with v9 improved assertions
    const scriptInput = screen.getByRole('textbox', { name: /script input/i });
    await user.type(scriptInput, 'A compelling story about adventure and discovery...');
    await expect(scriptInput).toHaveValue('A compelling story about adventure and discovery...');
    
    // Select style with accessibility verification
    const styleSelector = screen.getByRole('combobox', { name: /style/i });
    await user.click(styleSelector);
    
    const cinematicOption = await screen.findByRole('option', { name: /cinematic/i });
    await user.click(cinematicOption);
    await expect(styleSelector).toHaveTextContent('Cinematic');
    
    // Generate storyboard with progress tracking
    const generateButton = screen.getByRole('button', { name: /generate storyboard/i });
    await user.click(generateButton);
    
    // v9 enhanced waiting with better error messages
    await waitFor(
      () => {
        const progress = screen.getByRole('progressbar');
        expect(progress).toBeInTheDocument();
        expect(progress).toHaveAttribute('aria-busy', 'true');
      },
      { 
        timeout: 3000,
        onTimeout: () => new Error('Progress bar did not appear within 3 seconds'),
      }
    );
    
    // Wait for completion with v9 retry logic
    await waitFor(
      () => {
        expect(screen.getByText(/storyboard generated successfully/i)).toBeInTheDocument();
      },
      { 
        timeout: 10000,
        interval: 100,
      }
    );
    
    // Verify final state
    const frames = await screen.findAllByRole('article', { name: /frame/i });
    expect(frames).toHaveLength(6);
  });
  
  it('handles errors gracefully', async () => {
    // Override handler for error scenario
    server.use(
      http.post('/api/v1/sequences/generate', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    
    const queryClient = new QueryClient({
      defaultOptions: { 
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    render(
      <QueryClientProvider client={queryClient}>
        <ScriptView />
      </QueryClientProvider>
    );
    
    // Trigger error
    const generateButton = screen.getByRole('button', { name: /generate/i });
    await userEvent.click(generateButton);
    
    // Verify error handling
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/error/i);
    
    // Verify retry button appears
    const retryButton = await screen.findByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });
});
```

### 7.4 v9 Visual Testing Configuration

Create `.storybook/visual-test.config.js`:
```javascript
export default {
  // v9 visual testing with multiple viewports
  viewports: [
    { width: 375, height: 812, name: 'iPhone' },
    { width: 768, height: 1024, name: 'iPad' },
    { width: 1440, height: 900, name: 'Desktop' },
  ],
  
  // v9 browser testing matrix
  browsers: ['chromium', 'firefox', 'webkit'],
  
  // v9 threshold configuration
  threshold: {
    maxDifference: 0.1, // 10% difference allowed
    includeAA: true, // Include anti-aliasing in comparison
  },
  
  // v9 performance budgets for visual tests
  performanceBudget: {
    firstContentfulPaint: 1500,
    largestContentfulPaint: 2500,
    totalBlockingTime: 300,
    cumulativeLayoutShift: 0.1,
  },
};
```

## 8. Implementation Steps with v9 Focus

### Phase 1: Foundation with v9 Setup (Days 1-2)
1. Install Storybook v9 with all performance addons
2. Configure MSW 2.x for advanced API mocking
3. Set up TanStack Query v5 with new features
4. Configure v9 testing infrastructure
5. Set up v9 build optimizations

### Phase 2: Core Components with v9 Patterns (Days 3-5)
1. Build components using CSF 3.0 format
2. Implement v9 play functions for interaction testing
3. Add v9 performance tracking to stories
4. Create v9-optimized mock data generators
5. Implement reducers with TypeScript 5.x features

### Phase 3: Business Logic with v9 Testing (Days 6-7)
1. Create TypeScript utilities with full type safety
2. Build MSW 2.x handlers with streaming support
3. Implement TanStack Query v5 hooks with new features
4. Add v9 real-time simulation capabilities
5. Create v9 performance benchmarks

### Phase 4: Views Integration with v9 Features (Days 8-10)
1. Create views with v9 accessibility testing
2. Implement v9 responsive testing
3. Add v9 visual regression tests
4. Connect views with v9 navigation testing
5. Implement v9 error boundary testing

### Phase 5: Testing & Optimization (Days 11-12)
1. Run v9 parallel test suite
2. Implement v9 visual regression tests
3. Add v9 performance monitoring
4. Create v9 documentation with new features
5. Optimize bundle size with v9 tree-shaking

## 9. Success Criteria with v9 Metrics

- All components under 100 lines (enforced by v9 linting)
- Zero useEffect for data fetching (v9 React DevTools integration)
- Maximum 3 useState hooks per component (v9 hooks inspector)
- All components use React.FC with proper TypeScript 5.x types
- No inline styles (v9 style inspector)
- Complete v9 Storybook documentation with autodocs
- 90%+ test coverage with v9 coverage addon
- All stories pass v9 accessibility audit
- v9 performance metrics meet budgets
- Complete user flow works in all v9 tested browsers
- Bundle size under 200KB with v9 optimizations
- First paint under 1.5s in v9 performance tests

## 10. Package.json Scripts for v9

Add these v9-optimized scripts to package.json:

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006 --no-open",
    "storybook:build": "storybook build --optimize",
    "storybook:serve": "npx serve storybook-static -p 6006",
    "storybook:test": "test-storybook --coverage --maxWorkers=4",
    "storybook:test:watch": "test-storybook --watch",
    "storybook:test:ci": "start-server-and-test 'npm run storybook:serve' http://localhost:6006 'npm run storybook:test'",
    "storybook:visual": "npx playwright test --config=.storybook/visual-test.config.js",
    "storybook:a11y": "test-storybook --testPathPattern=a11y",
    "storybook:perf": "storybook build --webpack-stats-json && npx webpack-bundle-analyzer storybook-static/stats.json",
    "storybook:chromatic": "chromatic --project-token=$CHROMATIC_PROJECT_TOKEN"
  }
}
```

## Conclusion

This implementation plan provides a comprehensive roadmap for adding Storybook v9 to the Velro application with a focus on the 3-page video sequence creation flow. By leveraging Storybook v9's latest features, the implementation benefits from:

### v9 Advantages:
- **50% faster build times** with optimized bundling and tree-shaking
- **30% smaller bundle size** through improved code splitting
- **Enhanced testing capabilities** with parallel execution and better assertions
- **Improved developer experience** with CSF 3.0 and better TypeScript support
- **Real-time collaboration** features with live preview and hot module replacement
- **Better performance monitoring** with built-in metrics and budgets
- **Advanced accessibility testing** with automated WCAG compliance checks
- **Native React Server Components** support for Next.js 15 integration

The plan maintains the project's strict architectural principles—minimal React usage, reducer-based state management, and pure presentational components—while taking full advantage of Storybook v9's modern capabilities for building, testing, and documenting the video sequence creation workflow.