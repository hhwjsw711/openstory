import { queryOptions } from '@tanstack/react-query';
import { getSessionFn } from './server';

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: () => getSessionFn(),
  staleTime: 5 * 60 * 1000,
});
