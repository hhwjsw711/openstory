/**
 * Configure Cloudflare Logpush to send workers_trace_events to R2.
 *
 * Requires env vars:
 *   CLOUDFLARE_ACCOUNT_ID - Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN  - API token with Logpush permissions
 *
 * Usage: bun scripts/setup-logpush.ts
 */

export {};

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const R2_BUCKET = 'openstory-storage';
const LOG_PREFIX = 'logs/worker-traces/{DATE}';

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error(
    'Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN'
  );
  process.exit(1);
}

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

type CfResponse<T> = {
  success: boolean;
  errors: Array<{ message: string }>;
  result: T;
};

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const json: CfResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(
      `Cloudflare API error: ${json.errors.map((e) => e.message).join(', ')}`
    );
  }
  return json.result;
}

async function mainLoop() {
  // Check for existing logpush jobs for this dataset
  const existing =
    await cfFetch<Array<{ id: number; dataset: string }>>('/logpush/jobs');
  const existingJob = existing.find(
    (j) => j.dataset === 'workers_trace_events'
  );

  if (existingJob) {
    console.log(
      `Logpush job already exists for workers_trace_events (id: ${existingJob.id})`
    );
    return;
  }

  // Create logpush job
  const job = await cfFetch<{ id: number }>('/logpush/jobs', {
    method: 'POST',
    body: JSON.stringify({
      name: 'openstory-worker-traces',
      output_options: {
        field_names: [
          'EventTimestampMs',
          'EventType',
          'Outcome',
          'ScriptName',
          'Logs',
          'Exceptions',
        ],
        timestamp_format: 'rfc3339',
      },
      destination_conf: `r2://${R2_BUCKET}/${LOG_PREFIX}?account-id=${ACCOUNT_ID}`,
      dataset: 'workers_trace_events',
      enabled: true,
    }),
  });

  console.log(`Logpush job created (id: ${job.id})`);
  console.log(`Logs will appear in R2: ${R2_BUCKET}/${LOG_PREFIX}`);
}

void mainLoop().catch((err) => {
  console.error(err);
  process.exit(1);
});
