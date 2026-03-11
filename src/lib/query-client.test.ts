import { MutationObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, mock, vi } from 'bun:test';

import { makeQueryClient } from './query-client';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

describe('MutationCache', () => {
  afterEach(() => {
    mock.clearAllMocks();
  });

  it('invalidates matching queries when mutation has a mutationKey', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const observer = new MutationObserver(qc, {
      mutationKey: ['items', 'org-1'],
      mutationFn: () => Promise.resolve('ok'),
    });
    await observer.mutate();

    expect(spy).toHaveBeenCalledWith({
      queryKey: ['items', 'org-1'],
    });
  });

  it('invalidates ALL queries when mutation has no mutationKey', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const observer = new MutationObserver(qc, {
      mutationFn: () => Promise.resolve('ok'),
    });
    await observer.mutate();

    expect(spy).toHaveBeenCalledWith({
      queryKey: undefined,
    });
  });

  it('uses the correct key for each mutation', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const first = new MutationObserver(qc, {
      mutationKey: ['categories', 'org-1'],
      mutationFn: () => Promise.resolve('a'),
    });
    await first.mutate();

    const second = new MutationObserver(qc, {
      mutationKey: ['items', 'org-1'],
      mutationFn: () => Promise.resolve('b'),
    });
    await second.mutate();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, {
      queryKey: ['categories', 'org-1'],
    });
    expect(spy).toHaveBeenNthCalledWith(2, { queryKey: ['items', 'org-1'] });
  });

  it('shows error toast on mutation failure', async () => {
    const { toast } = await import('sonner');
    const qc = makeQueryClient();

    const observer = new MutationObserver(qc, {
      mutationKey: ['items'],
      mutationFn: () => Promise.reject(new Error('Server is down')),
    });

    expect(observer.mutate()).toThrow('Server is down');

    expect(toast.error).toHaveBeenCalledWith('Server is down');
  });

  it('does NOT invalidate queries on failure', async () => {
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const observer = new MutationObserver(qc, {
      mutationFn: () => Promise.reject(new Error('fail')),
    });
    expect(observer.mutate()).toThrow('fail');

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows error toast regardless of mutationKey presence', async () => {
    const { toast } = await import('sonner');
    const qc = makeQueryClient();

    const withKey = new MutationObserver(qc, {
      mutationKey: ['some-key'],
      mutationFn: () => Promise.reject(new Error('keyed error')),
    });
    expect(withKey.mutate()).toThrow('keyed error');

    const withoutKey = new MutationObserver(qc, {
      mutationFn: () => Promise.reject(new Error('unkeyed error')),
    });
    expect(withoutKey.mutate()).toThrow('unkeyed error');

    expect(toast.error).toHaveBeenCalledWith('keyed error');
    expect(toast.error).toHaveBeenCalledWith('unkeyed error');
    expect(toast.error).toHaveBeenCalledTimes(2);
  });
});
