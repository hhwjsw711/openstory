import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { sessionQueryOptions } from '@/lib/auth/session-query';
import {
  createFileRoute,
  Link,
  redirect,
  useParams,
} from '@tanstack/react-router';
import { Gift } from 'lucide-react';
import { useEffect } from 'react';

const STORAGE_KEY = 'openstory:pending-gift-code';

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export const Route = createFileRoute('/gift/$code')({
  beforeLoad: async ({ context: { queryClient }, params }) => {
    const code = normalizeCode(params.code);
    if (code.length !== 6) {
      throw redirect({ to: '/' });
    }

    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    if (session?.user) {
      throw redirect({
        to: '/credits',
        search: { tab: 'gift-codes', code },
      });
    }
  },
  component: GiftLandingPage,
});

function GiftLandingPage() {
  const { code: rawCode } = useParams({ from: '/gift/$code' });
  const code = normalizeCode(rawCode);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, code);
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Credits incoming!</CardTitle>
          <CardDescription>
            Sign in to redeem your gift and start creating.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/50 px-4 py-3">
            <p className="font-mono text-2xl font-bold tracking-widest">
              {code}
            </p>
          </div>
          <Button asChild size="lg">
            <Link
              to="/login"
              search={{ redirectTo: '/credits?tab=gift-codes' }}
            >
              Sign in to redeem
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
