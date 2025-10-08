/**
 * Signup Page
 * New user registration
 */

import { AuthForm } from "@/components/auth/auth-form";
import { PageContainer } from "@/components/layout";

export default function SignupPage() {
  return (
    <PageContainer>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Create Your Account</h1>
            <p className="mt-2 text-muted-foreground">
              Start creating cinematic content with AI
            </p>
          </div>
          <AuthForm mode="signup" />
        </div>
      </div>
    </PageContainer>
  );
}
