import Link from "next/link";
import { Button } from "@/components/ui/button";

export const SequencesPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Your Sequences
            </h1>
            <p className="text-muted-foreground">
              Manage and view all your video sequences in one place.
            </p>
          </div>

          <Button asChild>
            <Link href="/sequences/new">Create New Sequence</Link>
          </Button>
        </div>

        {/* TODO: Add sequences list component here when implemented */}
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="rounded-full bg-muted p-6">
            <svg
              className="w-12 h-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-label="Video sequence icon"
              aria-labelledby="Video sequence icon"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold">No sequences yet</h2>
          <p className="text-muted-foreground max-w-md">
            Get started by creating your first video sequence. Transform your
            script into professional video content with AI assistance.
          </p>
          <Button asChild size="lg">
            <Link href="/sequences/new">Create Your First Sequence</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SequencesPage;
