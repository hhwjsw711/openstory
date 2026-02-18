/**
 * Cloudflare Workflows trigger client
 *
 * Provides a typed interface for triggering Cloudflare Workflow instances
 * from server handlers. Replaces triggerWorkflow() from client.ts for
 * workflows that have been migrated to Cloudflare Workflows.
 *
 * Uses getEnv() from #env which resolves to `cloudflare:workers` env on
 * workerd and process.env on other runtimes. The workflow binding is only
 * available on Cloudflare Workers — callers must gate on USE_CF_WORKFLOWS.
 *
 * Usage:
 *   import { triggerCfImageWorkflow } from '@/lib/workflow/cf-client';
 *   const instanceId = await triggerCfImageWorkflow(input, {
 *     id: `image-${frame.id}`,
 *   });
 */

import { getEnv } from '#env';
import type { ImageWorkflowInput } from '@/lib/workflow/types';

type TriggerOptions = {
  /** Instance ID for deduplication. If an instance with this ID exists, no duplicate is created. */
  id?: string;
};

/**
 * Trigger the Cloudflare image generation workflow.
 *
 * In E2E tests, returns a mock ID without triggering the actual workflow.
 * Maps to: env.CF_IMAGE_WORKFLOW.create({ id, params })
 */
export async function triggerCfImageWorkflow(
  input: ImageWorkflowInput,
  options?: TriggerOptions
): Promise<string> {
  const envVars = getEnv();

  // Skip workflow triggers in E2E tests
  if (envVars.E2E_TEST === 'true') {
    const mockId = options?.id ?? `mock-cf-image-${Date.now()}`;
    console.log(
      `[E2E] Skipping CF image workflow trigger (mock ID: ${mockId})`
    );
    return mockId;
  }

  // Access the workflow binding from the Cloudflare env.
  // On workerd runtime, getEnv() returns Cloudflare.Env which includes this binding.
  // The 'in' check provides a runtime guard before accessing the binding.
  if (
    !envVars ||
    typeof envVars !== 'object' ||
    !('CF_IMAGE_WORKFLOW' in envVars)
  ) {
    throw new Error(
      'CF_IMAGE_WORKFLOW binding not available. Ensure the workflow is configured in wrangler.jsonc and you are running on Cloudflare Workers.'
    );
  }

  // Binding access at the workerd/node boundary — runtime-validated by 'in' check above
  // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Cloudflare binding
  const workflow = (envVars as unknown as Cloudflare.Env).CF_IMAGE_WORKFLOW;

  const instance = await workflow.create({
    id: options?.id,
    params: input,
  });

  console.log(
    '[CfWorkflow]',
    `Triggered CF image workflow, instance ID: ${instance.id}`
  );

  return instance.id;
}
