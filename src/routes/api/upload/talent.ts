/**
 * Streaming upload API route for talent media.
 * PUT /api/upload/talent?filename=photo.jpg&type=image&talentId=xxx
 * Body: raw file binary
 *
 * Streams request.body directly to R2 — no base64, no buffering in worker memory.
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { requireUser } from '@/lib/auth/action-utils';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';
import { handleApiError } from '@/lib/errors';
import { uploadStream } from '#storage';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { generateId } from '@/lib/db/id';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import {
  createTalentMediaRecord,
  getTalentById,
} from '@/lib/db/helpers/talent';

export const Route = createFileRoute('/api/upload/talent')({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        try {
          const user = await requireUser();
          const team = await getUserDefaultTeam(user.id);
          if (!team) {
            return json(
              { success: false, error: 'No team found' },
              { status: 400 }
            );
          }

          const url = new URL(request.url);
          const filename = url.searchParams.get('filename');
          type MediaType = 'image' | 'video' | 'recording';
          function isMediaType(value: string | null): value is MediaType {
            return (
              value === 'image' || value === 'video' || value === 'recording'
            );
          }
          const rawType = url.searchParams.get('type');
          const type: MediaType | null = isMediaType(rawType) ? rawType : null;
          const talentId = url.searchParams.get('talentId');

          if (!filename) {
            return json(
              { success: false, error: 'filename query param required' },
              { status: 400 }
            );
          }

          if (!request.body) {
            return json(
              { success: false, error: 'Request body required' },
              { status: 400 }
            );
          }

          // Verify talent ownership if talentId provided
          if (talentId) {
            const talent = await getTalentById(talentId);
            if (!talent || talent.teamId !== team.teamId) {
              return json(
                { success: false, error: 'Talent not found' },
                { status: 404 }
              );
            }
          }

          const ext = getExtensionFromUrl(filename);
          const mediaId = generateId();
          const contentType =
            request.headers.get('content-type') ??
            getMimeTypeFromExtension(ext);
          const contentLength = parseInt(
            request.headers.get('content-length') ?? '0',
            10
          );

          const storagePath = talentId
            ? `${team.teamId}/${talentId}/${mediaId}.${ext}`
            : `${team.teamId}/temp/${mediaId}.${ext}`;

          const result = await uploadStream(
            STORAGE_BUCKETS.TALENT,
            storagePath,
            request.body as ReadableStream<Uint8Array>,
            contentLength,
            { contentType }
          );

          // Create DB record if uploading to an existing talent
          if (talentId && type) {
            await createTalentMediaRecord({
              id: mediaId,
              talentId,
              type,
              url: result.publicUrl,
              path: result.path,
            });
          }

          return json({
            success: true,
            url: result.publicUrl,
            path: result.path,
            mediaId,
          });
        } catch (error) {
          const handledError = handleApiError(error);
          return json(
            { success: false, error: handledError.toJSON() },
            { status: handledError.statusCode }
          );
        }
      },
    },
  },
});
