import { afterEach, vi } from "vitest";

// Mock environment variables for testing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
