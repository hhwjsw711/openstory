/**
 * Durable LLM Call Helper
 * Encapsulates the 3-step pattern: prepare -> call -> log
 * Uses @tanstack/ai-openrouter adapters instead of context.api.openai.call
 */

import { getEnv } from '#env';
import { createAdapter } from '@/lib/ai/create-adapter';
import { callLLMStream } from '@/lib/ai/llm-client';
import type { TextModel } from '@/lib/ai/models';
import { getContextWindow } from '@/lib/ai/models.config';
import { sceneSplittingResultSchema } from '@/lib/ai/response-schemas';
import {
  createStreamingSceneParser,
  stripCodeFences,
} from '@/lib/ai/streaming-scene-parser';
import { ZERO_MICROS } from '@/lib/billing/money';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import type { ScopedDb } from '@/lib/db/scoped';
import type { PromptReference } from '@/lib/observability/langfuse';
import { getChatPrompt } from '@/lib/prompts';
import { getGenerationChannel } from '@/lib/realtime';
import { chat } from '@tanstack/ai';
import type { WorkflowContext } from '@upstash/workflow';
import { z } from 'zod';
import type { NewFrame } from '../db/schema';

export type DurableLLMCallConfig<TSchema extends z.ZodType> = {
  name: string;
  phase: { number: number; name: string };
  promptName: string;
  promptVariables?: Record<string, string>;
  modelId: TextModel;
  responseSchema: TSchema;
  additionalMetadata?: Record<string, unknown>;
};

export type DurableLLMCallContext = {
  sequenceId?: string;
  userId?: string;
  /** Override OpenRouter API key (e.g., user-provided key). Falls back to platform env key. */
  openRouterApiKey?: string;
  /** Scoped DB context for resolving team API keys and deducting credits. Falls back to env key when absent. */
  scopedDb?: ScopedDb;
};

/**
 * Execute a durable LLM call with the standard 3-step pattern:
 * 1. Prepare: Fetch prompt from Langfuse, emit phase start
 * 2. Call: LLM call via context.run() + @tanstack/ai-openrouter
 * 3. Log & Process: Log to Langfuse, parse response, emit phase complete
 *
 * Uses context.run() instead of context.api.openai.call() to avoid
 * passing API keys in headers that get stored in Upstash logs.
 */
export async function durableLLMCall<TInput, TSchema extends z.ZodType>(
  context: WorkflowContext<TInput>,
  config: DurableLLMCallConfig<TSchema>,
  callContext: DurableLLMCallContext
): Promise<z.infer<TSchema>> {
  const { name, phase, modelId } = config;
  const logName = `phase-${phase.number}-${name}`;
  const logTags = [name, `phase-${phase.number}`, 'analysis'];
  const logMetadata = {
    phase: phase.number,
    phaseName: phase.name,
    ...config.additionalMetadata,
  };

  // Step 1: Prepare -- fetch prompt and emit phase start
  const { messages, promptReference } = await context.run(
    `prepare-${name}`,
    async () => {
      if (callContext.sequenceId) {
        await getGenerationChannel(callContext.sequenceId).emit(
          'generation.phase:start',
          { phase: phase.number, phaseName: phase.name }
        );
      }

      const { prompt, messages } = await getChatPrompt(
        config.promptName,
        config.promptVariables
      );

      const promptReference: PromptReference | undefined = prompt
        ? {
            name: prompt.name,
            version: prompt.version,
            isFallback: prompt.isFallback,
          }
        : undefined;

      return { messages, promptReference };
    }
  );

  // Step 2: Durable LLM call (QStash retries step delivery on failure)
  const jsonResponse = await context.run(name, async () => {
    const openRouterApiKeyInfo = callContext.scopedDb
      ? await callContext.scopedDb.apiKeys.resolveKey('openrouter')
      : (() => {
          const env = getEnv();
          if (!env.OPENROUTER_KEY)
            throw new Error('No API key available for provider: openrouter');
          return { key: env.OPENROUTER_KEY, source: 'platform' as const };
        })();
    const adapter = createAdapter(modelId, openRouterApiKeyInfo.key);

    console.log(`[LLM:${logName}] Starting call`, {
      model: modelId,
      keySource: openRouterApiKeyInfo.source,
      messageCount: messages.length,
    });

    const systemPrompts: string[] = [];
    const chatMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompts.push(msg.content);
      } else {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const result = await chat({
      adapter,
      messages: chatMessages,
      systemPrompts,
      stream: false,
      maxTokens: Math.floor(getContextWindow(config.modelId) * 0.5),
      metadata: {
        observationName: logName,
        prompt: promptReference,
        tags: logTags,
        metadata: logMetadata,
        sessionId: callContext.sequenceId,
        userId: callContext.userId,
      },
      outputSchema: config.responseSchema,
    });

    console.log(`[LLM:${logName}] Call succeeded`);
    return result;
  });

  // Deduct LLM credits (cost tracked via Langfuse; adapter doesn't expose per-call usage)
  if (callContext.scopedDb) {
    await context.run(`deduct-llm-credits-${name}`, async () => {
      await deductWorkflowCredits({
        scopedDb: callContext.scopedDb,
        costMicros: ZERO_MICROS,
        usedOwnKey: !!callContext.openRouterApiKey,
        description: `LLM analysis (${modelId})`,
        metadata: {
          model: modelId,
          phase: phase.number,
          phaseName: phase.name,
          stepName: name,
          sequenceId: callContext.sequenceId,
        },
      });
    });
  }

  // Step 3: Emit phase complete
  await context.run(`log-${name}`, async () => {
    if (callContext.sequenceId) {
      await getGenerationChannel(callContext.sequenceId).emit(
        'generation.phase:complete',
        { phase: phase.number }
      );
    }
  });

  return jsonResponse;
}

// ============================================================================
// Streaming Scene Split
// ============================================================================

export type StreamingSceneSplitConfig = {
  promptName: string;
  promptVariables?: Record<string, string>;
  modelId: TextModel;
  responseSchema: typeof sceneSplittingResultSchema;
  sequenceId?: string;
  autoGenerateMotion?: boolean;
};

type StreamingSceneSplitResult = {
  scenes: z.infer<typeof sceneSplittingResultSchema>['scenes'];
  title: string;
  frameMapping: Array<{ sceneId: string; frameId: string }>;
};

/**
 * Streaming scene split with progressive frame creation.
 *
 * Replaces the separate durableLLMCall('scene-splitting') + 'update-title-and-create-frames'
 * steps with a single streaming call that creates frames as scenes arrive.
 *
 * Steps:
 * 1. prepare-scene-splitting — fetch prompt, emit phase start
 * 2. scene-splitting-stream — stream LLM response, create frames progressively
 * 3. reconcile-frames — ensure all frames exist (handles cached result replay)
 * 4. log-scene-splitting — deduct credits, emit phase complete
 */
export async function durableStreamingSceneSplit<TInput>(
  context: WorkflowContext<TInput>,
  config: StreamingSceneSplitConfig,
  callContext: DurableLLMCallContext
): Promise<StreamingSceneSplitResult> {
  const phase = { number: 1, name: 'Analyzing script…' };
  const name = 'scene-splitting';
  const logName = `phase-${phase.number}-${name}`;
  const logTags = [name, `phase-${phase.number}`, 'analysis'];
  const logMetadata = { phase: phase.number, phaseName: phase.name };

  // Step 1: Prepare — fetch prompt and emit phase start
  const { messages, promptReference } = await context.run(
    'prepare-scene-splitting',
    async () => {
      if (callContext.sequenceId) {
        await getGenerationChannel(callContext.sequenceId).emit(
          'generation.phase:start',
          { phase: phase.number, phaseName: phase.name }
        );
      }

      const { prompt, messages } = await getChatPrompt(
        config.promptName,
        config.promptVariables
      );

      const promptReference: PromptReference | undefined = prompt
        ? {
            name: prompt.name,
            version: prompt.version,
            isFallback: prompt.isFallback,
          }
        : undefined;

      return { messages, promptReference };
    }
  );

  // Step 2: Stream LLM response, create frames as scenes arrive
  // Returns the full parsed result + frame mapping (all serializable for QStash caching)
  const streamResult = await context.run('scene-splitting-stream', async () => {
    const openRouterApiKeyInfo = callContext.scopedDb
      ? await callContext.scopedDb.apiKeys.resolveKey('openrouter')
      : (() => {
          const env = getEnv();
          if (!env.OPENROUTER_KEY)
            throw new Error('No API key available for provider: openrouter');
          return { key: env.OPENROUTER_KEY, source: 'platform' as const };
        })();

    console.log(`[LLM:${logName}] Starting streaming call`, {
      model: config.modelId,
      keySource: openRouterApiKeyInfo.source,
      messageCount: messages.length,
    });

    const parser = createStreamingSceneParser();
    const frameMapping: Array<{ sceneId: string; frameId: string }> = [];
    let finalText = '';
    let chunkCount = 0;

    // Stream the LLM response
    for await (const chunk of callLLMStream({
      model: config.modelId,
      messages: messages,
      max_tokens: Math.floor(getContextWindow(config.modelId) * 0.5),
      responseSchema: config.responseSchema,
      apiKey: openRouterApiKeyInfo.key,
      observationName: logName,
      prompt: promptReference,
      tags: logTags,
      metadata: logMetadata,
    })) {
      chunkCount++;
      finalText = chunk.accumulated;
      const events = parser.feed(chunk.accumulated);

      if (chunkCount % 20 === 0) {
        console.log(
          `[Stream:${logName}] chunk #${chunkCount} | ${finalText.length} chars | ${frameMapping.length} frames so far`
        );
      }

      for (const event of events) {
        if (event.type === 'title' && config.sequenceId) {
          console.log(
            `[Stream:${logName}] 🎬 Title detected: "${event.title}" (chunk #${chunkCount})`
          );
          await callContext.scopedDb?.sequences.updateTitle(
            config.sequenceId,
            event.title
          );
          await getGenerationChannel(config.sequenceId).emit(
            'generation.updated',
            { title: event.title }
          );
        }

        if (event.type === 'scene') {
          console.log(
            `[Stream:${logName}] 🎬 Scene ${event.index + 1} complete: "${event.scene.metadata?.title}" (chunk #${chunkCount}, ${finalText.length} chars)`
          );
          await getGenerationChannel(config.sequenceId).emit(
            'generation.scene:new',
            {
              sceneId: event.scene.sceneId,
              sceneNumber: event.scene.sceneNumber,
              title: event.scene.metadata?.title || 'Untitled Scene',
              scriptExtract: event.scene.originalScript?.extract || '',
              durationSeconds: event.scene.metadata?.durationSeconds || 3,
            }
          );

          if (config.sequenceId && callContext.scopedDb) {
            const frame = await callContext.scopedDb?.frames.upsert({
              sequenceId: config.sequenceId,
              description: event.scene.originalScript?.extract || '',
              orderIndex: event.index,
              metadata: event.scene,
              durationMs: Math.round(
                (event.scene.metadata?.durationSeconds || 3) * 1000
              ),
              thumbnailStatus: 'generating',
              videoStatus: config.autoGenerateMotion ? 'generating' : 'pending',
            } satisfies NewFrame);

            console.log(
              `[Stream:${logName}] 💾 Frame created: ${frame.id} for scene "${event.scene.sceneId}"`
            );

            frameMapping.push({
              sceneId: event.scene.sceneId,
              frameId: frame.id,
            });

            await getGenerationChannel(config.sequenceId).emit(
              'generation.frame:created',
              {
                frameId: frame?.id || '',
                sceneId: event.scene.sceneId,
                orderIndex: event.index,
              }
            );
          }
        }
      }
    }

    // Parse final accumulated text with full schema (strip markdown fences some models add)
    const parsed = sceneSplittingResultSchema.parse(
      JSON.parse(stripCodeFences(finalText))
    );
    console.log(
      `[Stream:${logName}] ✅ Complete | ${chunkCount} chunks | ${parsed.scenes.length} scenes | ${finalText.length} chars`
    );

    return {
      scenes: parsed.scenes,
      projectMetadata: parsed.projectMetadata,
      frameMapping,
    };
  });

  // Step 3: Reconcile — ensure all frames exist (handles QStash cached result replay)
  const { scenes, title, frameMapping } = await context.run(
    'reconcile-frames',
    async () => {
      const { scenes, projectMetadata } = streamResult;
      const resolvedTitle = projectMetadata?.title || 'Untitled';

      if (!config.sequenceId || !callContext.scopedDb) {
        return {
          scenes,
          title: resolvedTitle,
          frameMapping: streamResult.frameMapping,
        };
      }
      const sequenceId = config.sequenceId;
      // Bulk upsert all frames to catch any missed during streaming
      // (e.g., QStash replays a cached step 2 result without re-firing side effects)
      const frameInserts = scenes.map(
        (scene, index) =>
          ({
            sequenceId,
            description: scene.originalScript?.extract || '',
            orderIndex: index,
            metadata: scene,
            durationMs: Math.round(
              (scene.metadata?.durationSeconds || 3) * 1000
            ),
            thumbnailStatus: 'generating',
            videoStatus: config.autoGenerateMotion ? 'generating' : 'pending',
          }) satisfies NewFrame
      );

      const reconciledFrames =
        await callContext.scopedDb.frames.bulkInsert(frameInserts);
      const reconciledMapping = reconciledFrames.map((f) => ({
        sceneId: f.metadata?.sceneId || '',
        frameId: f.id,
      }));

      // Ensure title, workflow, and status are set
      await callContext.scopedDb.sequences.updateTitle(
        config.sequenceId,
        resolvedTitle
      );
      await callContext.scopedDb.sequences.updateWorkflow(
        config.sequenceId,
        'analyze-script-shorter-prompts-batch-size-1'
      );
      await callContext.scopedDb.sequences.update({
        id: config.sequenceId,
        status: 'completed',
      });

      // Emit frame:created for any frames the streaming step didn't cover
      const streamedSceneIds = new Set(
        streamResult.frameMapping.map((f) => f.sceneId)
      );
      for (const { sceneId, frameId } of reconciledMapping) {
        if (!streamedSceneIds.has(sceneId)) {
          const scene = scenes.find((s) => s.sceneId === sceneId);
          await getGenerationChannel(config.sequenceId).emit(
            'generation.frame:created',
            {
              frameId,
              sceneId,
              orderIndex: scene?.sceneNumber ? scene.sceneNumber - 1 : 0,
            }
          );
        }
      }

      return {
        scenes,
        title: resolvedTitle,
        frameMapping: reconciledMapping,
      };
    }
  );

  // Step 4: Deduct credits + emit phase complete
  if (callContext.scopedDb) {
    await context.run('deduct-llm-credits-scene-splitting', async () => {
      await deductWorkflowCredits({
        scopedDb: callContext.scopedDb,
        costMicros: ZERO_MICROS,
        usedOwnKey: !!callContext.openRouterApiKey,
        description: `LLM analysis (${config.modelId})`,
        metadata: {
          model: config.modelId,
          phase: phase.number,
          phaseName: phase.name,
          stepName: name,
          sequenceId: callContext.sequenceId,
        },
      });
    });
  }

  await context.run('log-scene-splitting', async () => {
    if (callContext.sequenceId) {
      await getGenerationChannel(callContext.sequenceId).emit(
        'generation.phase:complete',
        { phase: phase.number }
      );
    }
  });

  return { scenes, title, frameMapping };
}
