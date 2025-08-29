import { createClient } from "@supabase/supabase-js";
import type { Database } from "../gen.types";

interface EnvironmentVariables {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const validateEnvironmentVariables = (): EnvironmentVariables => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missingVars: string[] = [];

  if (!supabaseUrl) {
    missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}. ` +
        `Please check your .env file and ensure all Supabase variables are set.`,
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl as string,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey as string,
  };
};

export const createServerClient = () => {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    validateEnvironmentVariables();

  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: "public",
      },
    },
  );
};

export const createAdminClient = () => {
  return createServerClient();
};
