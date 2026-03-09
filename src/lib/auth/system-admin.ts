import { getEnv } from '#env';
import { AuthenticationError } from '@/lib/errors';

function parseAdminEmails(): string[] {
  const raw = getEnv().ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSystemAdmin(email: string): boolean {
  return parseAdminEmails().includes(email.toLowerCase());
}

export function requireSystemAdmin(email: string): void {
  if (!isSystemAdmin(email)) {
    throw new AuthenticationError('System admin access required');
  }
}
