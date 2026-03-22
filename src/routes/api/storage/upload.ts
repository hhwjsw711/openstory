import { uploadFile } from '#storage';
import { authRequestMiddleware } from '@/functions/middleware';
import { resolveUserTeam } from '@/lib/db/scoped';
import { handleApiError } from '@/lib/errors';
import { STORAGE_BUCKETS, type StorageBucket } from '@/lib/storage/buckets';
import { createFileRoute } from '@tanstack/react-router';

const bucketByName = new Map<string, StorageBucket>(
  Object.values(STORAGE_BUCKETS).map((b) => [b, b])
);

export const Route = createFileRoute('/api/storage/upload')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      PUT: async ({ request, context }) => {
        try {
          const team = await resolveUserTeam(context.user.id);
          if (!team) {
            return Response.json(
              { success: false, error: 'No team found' },
              { status: 403 }
            );
          }

          const url = new URL(request.url);
          const bucket = url.searchParams.get('bucket');
          const path = url.searchParams.get('path');
          const contentType = url.searchParams.get('contentType');

          if (!bucket || !path || !contentType) {
            return Response.json(
              {
                success: false,
                error:
                  'Missing required query params: bucket, path, contentType',
              },
              { status: 400 }
            );
          }

          const validBucket = bucketByName.get(bucket);
          if (!validBucket) {
            return Response.json(
              { success: false, error: `Invalid bucket: ${bucket}` },
              { status: 400 }
            );
          }

          if (!path.includes(team.teamId)) {
            return Response.json(
              { success: false, error: 'Path must contain your team ID' },
              { status: 403 }
            );
          }

          const body = await request.arrayBuffer();

          await uploadFile(validBucket, path, body, {
            contentType,
          });

          return Response.json({ success: true });
        } catch (error) {
          const handledError = handleApiError(error);
          return Response.json(
            { success: false, error: handledError.toJSON() },
            { status: handledError.statusCode }
          );
        }
      },
    },
  },
});
