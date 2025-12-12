/**
 * Workflow status endpoint
 * Get the current state and logs of a workflow run
 */

import { getEnv } from '#env';
import { Client } from '@upstash/qstash';
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';

export const Route = createFileRoute('/api/workflows/status/$runId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { runId } = params;

          if (!runId) {
            return json({ error: 'Run ID is required' }, { status: 400 });
          }

          // Create QStash client
          const token = getEnv().QSTASH_TOKEN;
          if (!token) {
            return json({ error: 'QStash not configured' }, { status: 500 });
          }

          // Client will be used when workflow status API is integrated
          const _client = new Client({ token });

          // Get workflow run status using QStash client
          // Note: Workflow status API will be available through QStash client
          // For now, return a basic response
          const response = {
            runId,
            status: 'RUNNING',
            message: 'Workflow status endpoint - API integration pending',
          };

          return json(response);
        } catch (error) {
          console.error(
            '[Workflow Status] Error fetching workflow status',
            error
          );

          return json(
            {
              error: 'Failed to fetch workflow status',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
