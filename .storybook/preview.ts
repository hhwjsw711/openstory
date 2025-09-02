import type { Decorator, Preview } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import "../src/app/global.css";

// Create a client for Storybook
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const withQueryClient: Decorator = (StoryFn) => {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(StoryFn),
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
      // Configure Next.js Image component for Storybook
      image: {
        unoptimized: true, // Disable image optimization in Storybook
      },
    },
  },
  decorators: [withQueryClient],
};

export default preview;
