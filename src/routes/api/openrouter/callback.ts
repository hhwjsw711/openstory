/**
 * OpenRouter OAuth PKCE Callback
 * GET /api/openrouter/callback - Handles the redirect from OpenRouter after user authorization
 *
 * OpenRouter redirects here with ?code=... query parameter.
 * We exchange the code for an API key and redirect the user back to settings.
 */

import { createFileRoute } from '@tanstack/react-router';
import { completeOpenRouterOAuth } from '@/functions/openrouter-oauth';
import { requireUser } from '@/lib/auth/action-utils';
import { getUserDefaultTeam } from '@/lib/db/helpers/team-permissions';

function redirectResponse(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: path },
  });
}

export const Route = createFileRoute('/api/openrouter/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');

        if (!code) {
          return redirectResponse(
            '/settings?error=openrouter_oauth_missing_code'
          );
        }

        try {
          const user = await requireUser();
          const team = await getUserDefaultTeam(user.id);

          if (!team) {
            return redirectResponse('/settings?error=openrouter_oauth_no_team');
          }

          await completeOpenRouterOAuth(team.teamId, code);

          return redirectResponse('/settings?success=openrouter_connected');
        } catch (error) {
          console.error('[OpenRouter OAuth] Callback error:', error);
          return redirectResponse('/settings?error=openrouter_oauth_failed');
        }
      },
    },
  },
});
