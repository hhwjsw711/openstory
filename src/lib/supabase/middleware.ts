import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

interface MiddlewareEnvironmentVariables {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}

const validateMiddlewareEnvironmentVariables =
  (): MiddlewareEnvironmentVariables => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const missingVars: string[] = [];

    if (!supabaseUrl) {
      missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    }

    if (!supabaseAnonKey) {
      missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}. ` +
          "Please check your .env file and ensure all Supabase variables are set.",
      );
    }

    return {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl as string,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey as string,
    };
  };

export const createMiddlewareClient = (
  request: NextRequest,
  response: NextResponse,
) => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    validateMiddlewareEnvironmentVariables();

  return createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
};
