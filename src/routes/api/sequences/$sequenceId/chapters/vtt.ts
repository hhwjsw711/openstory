/**
 * Chapters VTT Endpoint (TanStack Start)
 * GET /api/sequences/:sequenceId/chapters.vtt - Generate WebVTT chapters for sequence
 */

import { requireAuth } from '@/lib/auth/api-utils';
import { createScopedDb, resolveUserTeam } from '@/lib/db/scoped';
import { handleApiError, ValidationError } from '@/lib/errors';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { generateChaptersVTT } from '@/lib/vtt/generate-chapters';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/sequences/$sequenceId/chapters/vtt')(
  {
    server: {
      handlers: {
        GET: async ({ request, params }) => {
          try {
            const { sequenceId } = params;

            // Validate ULID
            try {
              ulidSchema.parse(sequenceId);
            } catch {
              throw new ValidationError('Invalid sequence ID format');
            }

            // Authenticate user and resolve team
            const authResult = await requireAuth(request);
            const user = authResult.user;

            const team = await resolveUserTeam(user.id);
            if (!team) {
              return new Response('No team found', { status: 403 });
            }

            const scopedDb = createScopedDb(team.teamId);

            // Look up sequence (team-scoped)
            const sequence = await scopedDb.sequences.getById(sequenceId);

            if (!sequence) {
              return new Response('Sequence not found', { status: 404 });
            }

            // Get frames ordered by orderIndex
            const frames = await scopedDb.frames.listBySequence(sequenceId);

            if (frames.length === 0) {
              return new Response('No frames found for sequence', {
                status: 404,
              });
            }

            // Generate WebVTT chapters
            const vtt = generateChaptersVTT(frames);

            // Return as VTT format
            return new Response(vtt, {
              status: 200,
              headers: {
                'Content-Type': 'text/vtt',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            });
          } catch (error) {
            console.error(
              '[GET /api/sequences/$sequenceId/chapters.vtt] Error:',
              error
            );
            const handledError = handleApiError(error);

            return new Response(handledError.message, {
              status: handledError.statusCode,
            });
          }
        },
      },
    },
  }
);
