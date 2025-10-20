# Implementation Plan: Issue #8 - Generate Frames

## Issue Overview
**Title:** [Backend] Generate Frames  
**Number:** 8  
**Labels:** backend, frames  
**URL:** https://github.com/velro-ai/velro/issues/8

## Summary
Implement the frame generation system that creates storyboard frames from analyzed scripts with proper descriptions and metadata using QStash for async processing and AI for intelligent frame descriptions.

## Implementation Plan

### Phase 1: Core Infrastructure (Days 1-3)

#### 1.1 Extend Job System for Frame Generation
- **File:** `src/lib/qstash/types.ts`
- Add new job type: `FRAME_GENERATION`
- Add job payload interface for frame generation parameters

#### 1.2 Create Frame Generation Server Actions
- **File:** `src/app/actions/frames.ts`
- `generateFramesAction` - Server action to initiate frame generation
- Validates sequence exists and user has permissions
- Creates QStash job for async processing
- Returns job ID and optimistic frame placeholders

#### 1.3 Implement QStash Webhook Handler
- **File:** `src/app/webhooks/qstash/frames/route.ts`
- Processes frame generation jobs
- Calls AI service for frame description generation
- Updates database with generated frame data
- Handles error states and retries

### Phase 2: AI Integration (Days 4-6)

#### 2.1 Create AI Service Abstraction
- **File:** `src/lib/ai/frame-generator.ts`
- Service layer for frame generation AI calls
- Support for multiple providers (Anthropic/OpenAI)
- Prompt templates for consistent frame descriptions

#### 2.2 Script Analysis Service
- **File:** `src/lib/ai/script-analyzer.ts`
- Analyze scripts to identify frame boundaries
- Generate frame timing and duration
- Create visual descriptions based on script content

#### 2.3 Frame Description Generation
- **File:** `src/lib/ai/frame-descriptions.ts`
- Generate detailed visual descriptions for each frame
- Maintain consistency with style stacks
- Include character and setting information

### Phase 3: Additional Server Actions & Frontend Hooks (Days 7-8)

#### 3.1 Additional Server Actions
- **File:** `src/app/actions/frames.ts`
- `regenerateFrameAction` - Regenerates specific frame
- `updateFrameAction` - Updates frame metadata
- `deleteFrameAction` - Removes frame from sequence
- `reorderFramesAction` - Reorders frames in sequence
- Form validation with Zod schemas

#### 3.2 TanStack Query Hooks
- **File:** `src/hooks/use-frames.ts`
- `useFrames` - Fetch frames for sequence
- `useGenerateFrames` - Mutation for frame generation
- `useFrameGeneration` - Poll generation status
- Real-time updates via optimistic updates

#### 3.3 Enhanced Database Operations
- **File:** `src/lib/db/frames.ts`
- Database helper functions for frame operations
- Add optimistic locking with version field
- Enhanced error handling for concurrent updates
- Audit logging for frame modifications

### Phase 4: Optimization & Testing (Days 9-10)

#### 4.1 Performance Optimization
- Database indexing for frame queries
- Batch processing for multiple frame generation
- Rate limiting for AI API calls

#### 4.2 Testing Implementation
- Unit tests for AI service layer
- Integration tests for QStash workflow
- API endpoint testing with mocked dependencies

#### 4.3 Error Handling & Monitoring
- Comprehensive error states in database
- Retry logic for failed frame generation
- Logging and monitoring for AI API usage

## Database Schema Updates

### frames Table Enhancement
```sql
-- Add optimistic locking
ALTER TABLE frames ADD COLUMN version INTEGER DEFAULT 1;

-- Add enhanced metadata
ALTER TABLE frames ADD COLUMN generation_metadata JSONB;

-- Add indexes for performance
CREATE INDEX idx_frames_sequence_order ON frames(sequence_id, order_index);
CREATE INDEX idx_frames_generation_status ON frames(generation_status);
```

## Server Actions Design

### Frame Generation Actions

#### generateFramesAction
```typescript
// Input Schema
const generateFramesSchema = z.object({
  sequenceId: z.string().uuid(),
  options: z.object({
    frameCount: z.number().min(1).max(100).optional(),
    styleStackId: z.string().uuid().optional(),
    regenerateAll: z.boolean().optional(),
  }).optional(),
});

// Return Type
type GenerateFramesResult = {
  success: true;
  data: {
    jobId: string;
    frames: Frame[]; // Optimistic placeholders
    estimatedDuration: number;
  };
} | {
  success: false;
  error: string;
};
```

#### regenerateFrameAction
```typescript
const regenerateFrameSchema = z.object({
  frameId: z.string().uuid(),
  preserveMetadata: z.boolean().optional(),
});
```

## QStash Job Flow

1. **Initiation:** User triggers frame generation via server action
2. **Job Creation:** Server action creates QStash job with sequence data
3. **Processing:** Webhook handler processes each frame
4. **AI Analysis:** Script analyzed to determine frame boundaries
5. **Description Generation:** AI creates visual descriptions
6. **Database Update:** Frame data saved with metadata
7. **Frontend Update:** TanStack Query refetches updated data

## AI Integration Details

### Frame Generation Prompt Template
```
Analyze this script section and generate a detailed visual description for a storyboard frame:

Script: {scriptContent}
Scene Context: {sceneContext}
Style Guidelines: {styleStack}
Previous Frame: {previousFrameDescription}

Generate:
1. Visual description (2-3 sentences)
2. Character positions and actions
3. Setting details
4. Camera angle suggestion
5. Duration estimate (seconds)
```

## Technical Risks & Mitigation

1. **AI API Rate Limits**
   - Implement exponential backoff
   - Queue management with priority
   - Multiple provider fallback

2. **Prompt Quality**
   - A/B test different prompts
   - User feedback loop for improvements
   - Manual review for edge cases

3. **Database Concurrency**
   - Optimistic locking with version field
   - Proper error handling for conflicts
   - User-friendly conflict resolution

4. **Job Processing Failures**
   - Comprehensive retry logic
   - Dead letter queue for failed jobs
   - User notification of failures

5. **Performance at Scale**
   - Batch processing for large sequences
   - Database query optimization
   - Caching for frequently accessed data

6. **Script Format Variations**
   - Progressive format support
   - Fallback to manual frame creation
   - User feedback for unsupported formats

## Success Metrics

### Technical Metrics
- Frame generation time < 30 seconds for 10 frames
- AI API success rate > 95%
- Database query performance < 100ms
- Job processing success rate > 98%

### Business Metrics
- Sequence completion rate increase of 50%
- User adoption of frame generation > 80%
- Frame quality rating > 4/5
- Frame-to-script alignment accuracy > 90%

## Dependencies

### External Services
- AI Provider (Anthropic/OpenAI) API keys
- QStash configuration for new job type
- Database migrations for schema updates

### Internal Dependencies
- Existing sequence/script management system
- QStash job processing infrastructure
- TanStack Query setup
- Next.js 15 server actions with 'use server' directive

## Testing Strategy

### Unit Tests
- AI service layer with mocked responses
- Frame validation logic
- Database operations

### Integration Tests
- End-to-end frame generation workflow
- QStash job processing
- Server action functionality

### Manual Testing
- Various script formats and lengths
- Error scenarios and recovery
- Performance under load

## Implementation Ready

This plan provides a complete roadmap for implementing the frame generation system. The backend engineer can begin with Phase 1 and follow the detailed file-by-file implementation guide. Each phase builds on the previous one and can be deployed incrementally for testing and feedback.