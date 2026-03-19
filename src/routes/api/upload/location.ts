/**
 * Streaming upload API route for location media.
 * PUT /api/upload/location?filename=photo.jpg&locationId=xxx
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
  getLibraryLocationById,
  updateLibraryLocation,
} from '@/lib/db/helpers/location-library';

export const Route = createFileRoute('/api/upload/location')({
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
          const locationId = url.searchParams.get('locationId');

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

          // Verify location ownership if locationId provided
          if (locationId) {
            const location = await getLibraryLocationById(locationId);
            if (!location || location.teamId !== team.teamId) {
              return json(
                { success: false, error: 'Location not found' },
                { status: 404 }
              );
            }
          }

          const ext = getExtensionFromUrl(filename);
          const uploadId = generateId();
          const contentType =
            request.headers.get('content-type') ??
            getMimeTypeFromExtension(ext);
          const contentLength = parseInt(
            request.headers.get('content-length') ?? '0',
            10
          );

          const storagePath = locationId
            ? `${team.teamId}/library/${uploadId}.${ext}`
            : `${team.teamId}/temp/${uploadId}.${ext}`;

          const result = await uploadStream(
            STORAGE_BUCKETS.LOCATIONS,
            storagePath,
            request.body as ReadableStream<Uint8Array>,
            contentLength,
            { contentType }
          );

          // Update location record if uploading to an existing location
          if (locationId) {
            await updateLibraryLocation(locationId, {
              referenceImageUrl: result.publicUrl,
              referenceImagePath: result.path,
            });
          }

          return json({
            success: true,
            url: result.publicUrl,
            path: result.path,
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
