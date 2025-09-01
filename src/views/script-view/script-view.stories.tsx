import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScriptView } from "./script-view";

// Create a new QueryClient for each story to avoid state leakage
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const meta: Meta<typeof ScriptView> = {
  title: "Views/ScriptView",
  component: ScriptView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The main page component for creating video sequences, combining script writing with style selection and storyboard generation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  argTypes: {
    teamId: {
      description: "Optional team ID for fetching team-specific styles",
      control: "text",
    },
    onSequenceCreated: {
      description: "Callback fired when a sequence is created",
      action: "sequence created",
    },
    onStoryboardGenerated: {
      description: "Callback fired when storyboard generation starts",
      action: "storyboard generated",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScriptView>;

export const Default: Story = {
  args: {
    teamId: "team-123",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default ScriptView showing the complete user flow from script writing to storyboard generation.",
      },
    },
  },
};

export const WithTeamId: Story = {
  args: {
    teamId: "demo-team",
  },
  parameters: {
    docs: {
      description: {
        story:
          "ScriptView configured for a specific team with team-specific styles.",
      },
    },
  },
};

export const Standalone: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "ScriptView without a team ID, showing default behavior.",
      },
    },
  },
};
