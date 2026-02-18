/**
 * Custom Cloudflare Worker entry point.
 *
 * Re-exports the default TanStack Start server handler and additionally
 * exports Cloudflare Workflow classes so wrangler can discover them.
 *
 * wrangler.jsonc "main" points here instead of "@tanstack/react-start/server-entry"
 * when building for Cloudflare (BUILD_CLOUDFLARE=1).
 */

// Re-export the default fetch handler from TanStack Start
export { default } from '@tanstack/react-start/server-entry';

// Export Cloudflare Workflow classes (referenced by class_name in wrangler.jsonc)
export { CfImageWorkflow } from '@/lib/workflows/cf/image-workflow.cf';
