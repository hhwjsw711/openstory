/**
 * Settings Index - Redirects to API keys page
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/api-keys' });
  },
});
