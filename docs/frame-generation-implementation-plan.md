# Frame Generation System - Implementation Plan

## Issue #8: [Backend] Generate Frames

### Executive Summary

This document outlines the comprehensive implementation plan for the frame generation system that creates storyboard frames from analyzed scripts with proper descriptions and metadata. The system will integrate with QStash for asynchronous processing and utilize AI services for intelligent frame generation.

---

## 1. Architecture Review

### Current State Analysis

#### Existing Components:

- **Database Schema**: `frames` table already exists with proper structure
  - Fields: `id`, `sequence_id`, `order_index`, `description`, `duration_ms`, `thumbnail_url`, `video_url`, `metadata`
  - Proper indexes and foreign key relationships in place
- **Job System**: Robust QStash integration already implemented
  - Job manager (`/src/lib/qstash/job-manager.ts`)
  - QStash client with typed message publishing
  - Webhook handlers for async processing
- **Server Actions**: Basic frame CRUD operations exist
  - `/src/app/actions/frames/index.ts` - Complete CRUD operations
  - `/src/app/actions/sequence/index.ts` - Has placeholder `generateFrames` function
- **Frontend Hooks**: TanStack Query hooks ready
  - `/src/hooks/use-frames.ts` - Full set of hooks for frame operations

#### Gaps to Address:

1. No dedicated frame generation job type in QStash system
2. AI service integration not yet implemented
3. Frame generation logic is currently using mock data
4. No webhook handler for frame generation processing
5. Missing optimistic locking implementation
6. No frame-to-script relationship tracking in metadata

---

## 2. API Design

### New API Endpoints

#### `/frames/generate` - POST

```typescript
interface GenerateFramesRequest {
  sequenceId: string;
  script: string;
  styleId?: string;
  options?: {
    targetFrameCount?: number; // 3-7 frames per scene average
    aspectRatio?: string; // "16:9", "9:16", etc.
    duration?: number; // Total duration in seconds
  };
}

interface GenerateFramesResponse {
  success: boolean;
  jobId: string;
  message: string;
  estimatedCompletionTime: string;
}
```

#### `/frames/[id]` - CRUD Operations

```typescript
// GET - Get single frame with relationships
interface GetFrameResponse {
  frame: Frame & {
    scriptSection?: {
      startLine: number;
      endLine: number;
      content: string;
    };
  };
}

// PATCH - Update frame with optimistic locking
interface UpdateFrameRequest {
  description?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  version: number; // For optimistic locking
}
```

#### `/frames/regenerate` - POST

```typescript
interface RegenerateFrameRequest {
  frameId: string;
  regenerateOptions: {
    description?: boolean;
    thumbnail?: boolean;
    metadata?: boolean;
  };
}
```

---

## 3. QStash Integration Design

### New Job Type: FRAME_GENERATION

#### Job Manager Extensions

```typescript
// Add to JobType enum
export const JobType = {
  IMAGE: "image",
  VIDEO: "video",
  SCRIPT: "script",
  FRAME_GENERATION: "frame_generation", // NEW
  FRAME_THUMBNAIL: "frame_thumbnail", // NEW
} as const;

// Frame generation payload
interface FrameGenerationPayload {
  sequenceId: string;
  script: string;
  styleId?: string;
  targetFrameCount: number;
  aspectRatio: string;
  scriptAnalysis?: {
    scenes: SceneAnalysis[];
    characters: CharacterInfo[];
  };
}
```

### Webhook Handler: `/webhooks/qstash/frames/route.ts`

```typescript
const processFrameGeneration: JobProcessor = async (
  payload: JobPayload,
  metadata
) => {
  // 1. Analyze script for scene boundaries
  const scriptAnalysis = await analyzeScript(payload.data.script);

  // 2. Generate frame descriptions using AI
  const frameDescriptions = await generateFrameDescriptions(
    scriptAnalysis,
    payload.data.targetFrameCount
  );

  // 3. Calculate durations based on dialogue and action
  const framesWithDuration = calculateFrameDurations(
    frameDescriptions,
    scriptAnalysis
  );

  // 4. Store frames in database
  const frames = await bulkCreateFrames(
    payload.data.sequenceId,
    framesWithDuration
  );

  // 5. Queue thumbnail generation jobs for each frame
  for (const frame of frames) {
    await queueThumbnailGeneration(frame);
  }

  return {
    totalFrames: frames.length,
    averageDuration: calculateAverageDuration(frames),
    scriptCoverage: calculateScriptCoverage(frames, scriptAnalysis),
  };
};
```

---

## 4. Database Schema Updates

### Add Version Column for Optimistic Locking

```sql
-- Migration: Add version column to frames table
ALTER TABLE frames
ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;

-- Add index for performance
CREATE INDEX idx_frames_version ON frames(version);

-- Update trigger to increment version on update
CREATE OR REPLACE FUNCTION increment_frame_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_frames_version
BEFORE UPDATE ON frames
FOR EACH ROW EXECUTE FUNCTION increment_frame_version();
```

### Enhanced Metadata Structure

```typescript
interface FrameMetadata {
  scriptSection: {
    startLine: number;
    endLine: number;
    startCharacter: number;
    endCharacter: number;
    content: string;
  };
  sceneInfo: {
    sceneNumber: number;
    setting: string;
    timeOfDay?: string;
    characters: string[];
  };
  generationParams: {
    model: string;
    prompt: string;
    styleStackId?: string;
    timestamp: string;
  };
  aiAnalysis: {
    mood: string;
    cameraAngle?: string;
    shotType?: string;
    keyElements: string[];
  };
}
```

---

## 5. AI Integration Plan

### Service Architecture

```typescript
// /src/lib/ai/frame-generator.ts
export interface AIFrameGenerator {
  analyzeScript(script: string): Promise<ScriptAnalysis>;
  generateFrameDescriptions(
    analysis: ScriptAnalysis,
    count: number
  ): Promise<FrameDescription[]>;
  generateThumbnailPrompt(
    frame: FrameDescription,
    style?: StyleStack
  ): Promise<string>;
}

// Implementation with provider abstraction
class FrameGeneratorService implements AIFrameGenerator {
  constructor(
    private provider: AIProvider // OpenAI, Anthropic, etc.
  ) {}

  async analyzeScript(script: string): Promise<ScriptAnalysis> {
    const prompt = buildScriptAnalysisPrompt(script);
    const response = await this.provider.complete(prompt);
    return parseScriptAnalysis(response);
  }

  // ... other methods
}
```

### AI Provider Integration

```typescript
// /src/lib/ai/providers/anthropic.ts
export class AnthropicProvider implements AIProvider {
  async complete(prompt: string): Promise<string> {
    // Use Claude for script analysis and frame generation
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20241022",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });
    return response.content[0].text;
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Core Infrastructure (Days 1-3)

<details>
<summary>Tasks</summary>

1. **Extend Job System**
   - Add FRAME_GENERATION job type to job-manager.ts
   - Create frame generation job payload types
   - Add publishFrameGenerationJob method to QStash client
2. **Create Frame Generation API Route**
   - Implement `/frames/generate/route.ts`
   - Add validation schemas with Zod
   - Integrate with job manager
3. **Implement Webhook Handler**
   - Create `/webhooks/qstash/frames/route.ts`
   - Implement basic frame generation flow with mock AI
   - Add proper error handling and logging
4. **Database Migration**
   - Add version column for optimistic locking
   - Create migration script
   - Test migration on local Supabase
   </details>

### Phase 2: AI Integration (Days 4-6)

<details>
<summary>Tasks</summary>

1. **Setup AI Provider**
   - Create AI provider abstraction layer
   - Implement Anthropic/OpenAI provider
   - Add environment variables for API keys
2. **Script Analysis Service**
   - Implement script parsing and scene detection
   - Create character extraction logic
   - Build dialogue/action duration calculator
3. **Frame Description Generator**
   - Create prompts for frame generation
   - Implement description generation with AI
   - Add style stack integration for consistency
4. **Testing AI Integration**
   - Create test scripts with various complexities
   - Validate frame generation quality
   - Tune prompts for better results
   </details>

### Phase 3: Server Actions & Hooks (Days 7-8)

<details>
<summary>Tasks</summary>

1. **Update Server Actions**
   - Replace mock implementation in `generateFrames`
   - Add new action `generateFramesWithAI`
   - Implement optimistic locking in update operations
2. **Enhance React Hooks**
   - Create `useGenerateFrames` mutation hook
   - Add progress tracking for generation jobs
   - Implement optimistic updates for better UX
3. **Error Handling**
   - Add retry logic for failed generations
   - Implement partial success handling
   - Create user-friendly error messages
   </details>

### Phase 4: Optimization & Testing (Days 9-10)

<details>
<summary>Tasks</summary>

1. **Performance Optimization**
   - Implement frame generation batching
   - Add caching for script analysis results
   - Optimize database queries with proper indexes
2. **Comprehensive Testing**
   - Unit tests for AI service
   - Integration tests for job flow
   - E2E tests for complete generation pipeline
3. **Monitoring & Logging**
   - Add detailed logging for debugging
   - Implement performance metrics
   - Create monitoring dashboard
   </details>

---

## 7. Technical Risks & Mitigation

### Risk Matrix

| Risk                          | Probability | Impact | Mitigation Strategy                                                       |
| ----------------------------- | ----------- | ------ | ------------------------------------------------------------------------- |
| **AI API Rate Limits**        | Medium      | High   | Implement request queuing and batching; Add multiple provider fallbacks   |
| **Frame Description Quality** | Medium      | Medium | Create prompt templates; A/B test different prompts; Allow manual editing |
| **Script Parsing Complexity** | High        | Medium | Start with simple formats; Progressive enhancement for complex scripts    |
| **Job Processing Delays**     | Low         | Medium | Implement priority queues; Add progress indicators; Cache results         |
| **Database Concurrency**      | Low         | High   | Use optimistic locking; Implement retry logic; Add transaction isolation  |
| **Cost Overruns (AI APIs)**   | Medium      | Medium | Monitor usage closely; Implement spending limits; Cache AI responses      |

### Mitigation Implementation Details

#### 1. AI API Rate Limiting

```typescript
class RateLimitedAIProvider {
  private queue = new PQueue({
    concurrency: 5,
    interval: 1000,
    intervalCap: 10,
  });

  async complete(prompt: string) {
    return this.queue.add(() => this.provider.complete(prompt));
  }
}
```

#### 2. Prompt Quality Assurance

```typescript
const FRAME_GENERATION_PROMPT = `
Analyze the following script section and generate detailed frame descriptions.
Each frame should include:
1. Visual description (setting, characters, action)
2. Mood and atmosphere
3. Camera angle suggestion
4. Key visual elements

Script: {script}
Target frames: {frameCount}
Style guide: {styleGuide}

Generate JSON array of frame descriptions...
`;
```

#### 3. Progressive Script Support

```typescript
enum ScriptFormat {
  PLAIN_TEXT = "plain",
  FOUNTAIN = "fountain",
  FINAL_DRAFT = "fdx",
  CELTX = "celtx",
}

class ScriptParser {
  parse(script: string, format: ScriptFormat) {
    switch (format) {
      case ScriptFormat.PLAIN_TEXT:
        return this.parsePlainText(script);
      case ScriptFormat.FOUNTAIN:
        return this.parseFountain(script);
      default:
        return this.parsePlainText(script); // Fallback
    }
  }
}
```

---

## 8. Success Metrics

### Technical Metrics

- **Generation Speed**: < 30 seconds for 10 frames
- **AI API Success Rate**: > 95%
- **Frame Quality Score**: > 80% user satisfaction
- **System Uptime**: > 99.9%

### Business Metrics

- **User Adoption**: 50% of sequences use frame generation
- **Completion Rate**: 80% of started generations complete
- **Cost per Generation**: < $0.10 per sequence
- **User Retention**: 70% use feature multiple times

### Quality Metrics

- **Frame-Script Alignment**: 90% accuracy
- **Duration Accuracy**: ±10% of actual video timing
- **Description Relevance**: 85% semantic match to script

---

## 9. Testing Strategy

### Unit Tests

```typescript
// /src/lib/ai/__tests__/frame-generator.test.ts
describe("FrameGenerator", () => {
  test("generates correct number of frames", async () => {
    const generator = new FrameGenerator(mockProvider);
    const frames = await generator.generate(script, 5);
    expect(frames).toHaveLength(5);
  });

  test("calculates duration based on dialogue", async () => {
    const frames = await generator.generate(dialogueScript, 3);
    expect(frames[0].duration_ms).toBeGreaterThan(3000);
  });
});
```

### Integration Tests

```typescript
// /src/app/frames/generate/__tests__/route.test.ts
describe("Frame Generation API", () => {
  test("creates job and returns jobId", async () => {
    const response = await POST(mockRequest);
    const data = await response.json();
    expect(data.jobId).toBeDefined();
    expect(data.success).toBe(true);
  });
});
```

### E2E Tests

```typescript
// /e2e/frame-generation.spec.ts
test("complete frame generation flow", async ({ page }) => {
  await page.goto("/sequences/new");
  await page.fill("[data-testid=script-input]", testScript);
  await page.click("[data-testid=generate-frames]");
  await expect(page.locator("[data-testid=frame-card]")).toHaveCount(5);
});
```

---

## 10. Documentation Requirements

### API Documentation

- OpenAPI spec for all frame endpoints
- Webhook payload documentation
- Error code reference

### Developer Documentation

- Frame generation architecture guide
- AI prompt engineering guidelines
- Testing guide for frame generation

### User Documentation

- Frame generation best practices
- Script formatting guide
- Troubleshooting common issues

---

## Appendix A: File Structure

```
src/
├── app/
│   ├── actions/
│   │   └── frames/
│   │       ├── generate.ts      # NEW: Frame generation action
│   │       └── index.ts         # UPDATE: Add generation support
│   ├── api/
│   │   └── v1/
│   │       ├── frames/
│   │       │   ├── generate/    # NEW: Generation endpoint
│   │       │   │   └── route.ts
│   │       │   └── [id]/        # NEW: Frame CRUD endpoints
│   │       │       └── route.ts
│   │       └── webhooks/
│   │           └── qstash/
│   │               └── frames/  # NEW: Frame webhook
│   │                   └── route.ts
├── lib/
│   ├── ai/                      # NEW: AI integration
│   │   ├── frame-generator.ts
│   │   ├── script-analyzer.ts
│   │   └── providers/
│   │       ├── anthropic.ts
│   │       └── openai.ts
│   └── qstash/
│       ├── client.ts            # UPDATE: Add frame job publishing
│       └── job-manager.ts       # UPDATE: Add frame job type
└── hooks/
    └── use-frames.ts            # UPDATE: Add generation hooks
```

---

## Appendix B: Environment Variables

```bash
# AI Service Configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
AI_PROVIDER=anthropic # or openai

# Frame Generation Settings
MAX_FRAMES_PER_SCENE=7
MIN_FRAMES_PER_SCENE=3
DEFAULT_FRAME_DURATION_MS=3000
FRAME_GENERATION_TIMEOUT_MS=60000

# Feature Flags
ENABLE_AI_FRAME_GENERATION=true
ENABLE_FRAME_REGENERATION=true
```

---

## Next Steps

1. **Review & Approval**: Get stakeholder approval on this plan
2. **Team Assignment**: Assign developers to each phase
3. **Environment Setup**: Configure AI API keys and test environments
4. **Sprint Planning**: Break down phases into sprint tasks
5. **Begin Implementation**: Start with Phase 1 infrastructure

---

## References

- [QStash Documentation](https://docs.upstash.com/qstash)
- [Anthropic API Reference](https://docs.anthropic.com/claude/reference)
- [Supabase Database Functions](https://supabase.com/docs/guides/database)
- [TanStack Query Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations)
