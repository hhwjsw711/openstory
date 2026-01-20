#!/usr/bin/env bun
import { $ } from 'bun';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

// Check install
try {
  await $`cloudflared --version`.quiet();
} catch {
  console.error(
    'Error: cloudflared not installed. Run: brew install cloudflared'
  );
  process.exit(1);
}

// Simple prompt helper
const ask = async (q: string, def: string) => {
  process.stdout.write(`${q} [${def}]: `);
  for await (const line of console) return line.trim() || def;
  return def;
};

console.log('Cloudflare Tunnel Setup\n');

const name = await ask('Tunnel Name', 'velro-local');
const domain = await ask('Domain', 'local.velro.ai');
const port = await ask('Local Port', '3000');

// Login check
if (!existsSync(join(homedir(), '.cloudflared', 'cert.pem'))) {
  console.log('\nNo certificate found. Opening login...');
  await $`cloudflared tunnel login`;
}

// Create or get tunnel
console.log(`\nConfiguring tunnel '${name}'...`);
let id = '';

// Try create (ignore error if exists)
try {
  await $`cloudflared tunnel create ${name}`.quiet();
} catch {}

// Get ID
try {
  const info = await $`cloudflared tunnel info ${name}`.text();
  id = info.match(/Tunnel ([0-9a-f-]{36})/i)?.[1] || '';
} catch {
  console.error('Could not find or create tunnel.');
  process.exit(1);
}

if (!id) {
  console.error('Failed to retrieve Tunnel ID.');
  process.exit(1);
}

// Route DNS (force)
try {
  await $`cloudflared tunnel route dns -f ${name} ${domain}`.quiet();
} catch {
  console.warn('DNS routing skipped (might already exist).');
}

// Write Config
const configDir = join(homedir(), '.cloudflared');
if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

const config = `tunnel: ${id}
credentials-file: ${join(configDir, `${id}.json`)}
protocol: http2

ingress:
  - hostname: ${domain}
    service: http://localhost:${port}
  - service: http_status:404
`;

await Bun.write(join(configDir, 'config.yml'), config);

console.log(`\n✓ Setup complete! Config written to ~/.cloudflared/config.yml`);
console.log(`\nStart your tunnel with:\ncloudflared tunnel run ${name}`);
