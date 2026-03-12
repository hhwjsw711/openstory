import {
  clearMemorySamples,
  getMemorySamples,
  initMemoryProfiler,
  isMemoryProfilerEnabled,
} from '@/lib/observability/memory-profiler';
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';

function ensureProfiler() {
  initMemoryProfiler();
  return isMemoryProfilerEnabled();
}

export const Route = createFileRoute('/api/dev/memory')({
  server: {
    handlers: {
      GET: async () => {
        if (!ensureProfiler()) {
          return json(
            { error: 'Memory profiler is only available in development' },
            { status: 404 }
          );
        }

        const samples = getMemorySamples();
        return json({ sampleCount: samples.length, samples });
      },
      DELETE: async () => {
        if (!ensureProfiler()) {
          return json(
            { error: 'Memory profiler is only available in development' },
            { status: 404 }
          );
        }

        clearMemorySamples();
        return json({ cleared: true });
      },
    },
  },
});
