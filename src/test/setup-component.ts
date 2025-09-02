import "@testing-library/jest-dom/vitest";
import type { ImageProps } from "next/image";
import React from "react";
import { afterEach, vi } from "vitest";

// Make React available globally for component tests
globalThis.React = React;

// Mock environment variables for testing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: (props: ImageProps) => {
    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement("img", {
      ...props,
      src:
        typeof props.src === "string"
          ? props.src
          : "default" in props.src
            ? props.src.default.src
            : props.src,
      loading: props.priority ? undefined : "lazy",
    });
  },
}));

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
