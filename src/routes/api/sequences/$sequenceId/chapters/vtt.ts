/**
 * Chapters VTT Endpoint (TanStack Start)
 * GET /api/sequences/:sequenceId/chapters.vtt - Generate WebVTT chapters for sequence
 */

import { requireTeamMemberAccess } from '@/lib/auth/action-utils';
import { requireAuth } from '@/lib/auth/api-utils';
import { getSequenceById } from '@/lib/db/helpers/queries';
import { handleApiError, ValidationError } from '@/lib/errors';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
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

            // Authenticate user
            const authResult = await requireAuth(request);
            const user = authResult.user;

            // Verify user has access to the sequence's team
            const sequence = await getSequenceById(sequenceId);

            if (!sequence) {
              return new Response('Sequence not found', { status: 404 });
            }

            await requireTeamMemberAccess(user.id, sequence.teamId);

            // Get frames ordered by orderIndex
            const frames = await getSequenceFrames(sequenceId);

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
