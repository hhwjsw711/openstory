import Link from "next/link";
import { Button } from "@/components/ui/button";

export const HomePage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            AI-Powered Video Sequence Creation
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your scripts into consistent, styled video productions
            using multiple AI models. Create professional video sequences with
            ease.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/sequences/new">Create New Sequence</Link>
          </Button>

          <Button variant="outline" size="lg" asChild>
            <Link href="/sequences">View Sequences</Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Script-Driven</h3>
            <p className="text-muted-foreground">
              Everything generates from your script to maintain consistency
              across all frames and scenes.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Style Stacks</h3>
            <p className="text-muted-foreground">
              Use consistent visual styles across different AI models with our
              innovative Style Stack system.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Team Collaboration</h3>
            <p className="text-muted-foreground">
              Share characters, styles, and resources with your team for
              seamless collaborative video creation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
