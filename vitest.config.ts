/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "src/test/",
        "*.config.*",
        "**/*.d.ts",
        "**/*.types.ts",
        "**/database.types.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
      ],
    },
    exclude: ["**/*.stories.{js,jsx,ts,tsx}"], // Exclude stories from default test run
    testTimeout: 20000, // Increased timeout for CI environment
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
          exclude: [
            "**/*.stories.{js,jsx,ts,tsx}", // Exclude stories
            "src/**/*.{test,spec}.{jsx,tsx}", // Exclude component tests
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          include: ["src/**/*.{test,spec}.{jsx,tsx}"],
          exclude: ["**/*.stories.{js,jsx,ts,tsx}"], // Exclude stories from component tests
          setupFiles: ["./src/test/setup-component.ts"], // Use component setup for React tests
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
