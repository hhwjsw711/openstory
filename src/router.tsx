import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { DefaultNotFound } from './components/error/default-not-found';
import { getQueryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = getQueryClient();

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
    defaultNotFoundComponent: DefaultNotFound,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
