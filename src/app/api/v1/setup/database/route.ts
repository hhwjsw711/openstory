import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { handleApiError, ValidationError } from "@/lib/errors";
import { initializeDatabaseSchema } from "@/lib/schemas/setup";
import { createAdminClient } from "@/lib/supabase/server";

// Create a type for valid table names from our Database type
type TableName = keyof Database["public"]["Tables"];

const checkTableExists = async (
  supabase: ReturnType<typeof createAdminClient>,
  tableName: string,
): Promise<boolean> => {
  // Known valid table names from our schema
  const validTables: Record<string, TableName> = {
    teams: "teams",
    users: "users",
    team_members: "team_members",
    sequences: "sequences",
    frames: "frames",
    styles: "styles",
    characters: "characters",
    audio: "audio",
    vfx: "vfx",
  };

  const validTableName = validTables[tableName];
  if (!validTableName) {
    return false; // Unknown table
  }

  try {
    const { error } = await supabase
      .from(validTableName as TableName)
      .select("id")
      .limit(1);
    // If error is null or error message doesn't indicate table missing, table exists
    return !error || !error.message.includes("does not exist");
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = initializeDatabaseSchema.parse(body);

    const supabase = createAdminClient();

    if (input.skipIfExists) {
      const teamsExist = await checkTableExists(supabase, "teams");

      if (teamsExist) {
        const { data: existingTeams } = await supabase
          .from("teams")
          .select("id")
          .limit(1);

        if (existingTeams && existingTeams.length > 0) {
          return NextResponse.json({
            success: true,
            message: "Database already initialized",
            skipped: true,
          });
        }
      }
    }

    const results = {
      tablesCreated: [] as string[],
      bucketsCreated: [] as string[],
      errors: [] as string[],
    };

    // Check which tables exist
    const tablesToCheck = [
      "teams",
      "users",
      "team_members", // Added missing table from the validTables mapping
      "sequences",
      "frames",
      "styles",
      "characters",
      "audio",
      "vfx",
    ];

    // Check which tables exist
    try {
      for (const tableName of tablesToCheck) {
        const exists = await checkTableExists(supabase, tableName);
        if (exists) {
          results.tablesCreated.push(tableName);
        }
      }
    } catch (error) {
      results.errors.push(
        `Failed to check table existence: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Check and create storage buckets
    try {
      const { data: buckets, error: listError } =
        await supabase.storage.listBuckets();

      if (listError) {
        results.errors.push(
          `Failed to list storage buckets: ${listError.message}`,
        );
      } else {
        const expectedBuckets = [
          "thumbnails",
          "videos",
          "characters",
          "styles",
          "audio",
          "scripts",
          "exports",
        ];

        const publicBuckets = [
          "thumbnails",
          "videos",
          "characters",
          "styles",
          "audio",
        ];

        for (const bucket of expectedBuckets) {
          const exists = buckets?.some((b) => b.id === bucket);
          if (exists) {
            results.bucketsCreated.push(bucket);
          } else {
            const { error } = await supabase.storage.createBucket(bucket, {
              public: publicBuckets.includes(bucket),
            });

            if (error) {
              results.errors.push(
                `Failed to create bucket ${bucket}: ${error.message}`,
              );
            } else {
              results.bucketsCreated.push(bucket);
            }
          }
        }
      }
    } catch (error) {
      results.errors.push(
        `Storage operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Seed test data if requested
    if (input.seedData) {
      try {
        const { data: authUser, error: authError } =
          await supabase.auth.admin.createUser({
            email: "test@example.com",
            password: "test123456",
            email_confirm: true,
          });

        if (authError) {
          results.errors.push(
            `Failed to create auth user: ${authError.message}`,
          );
        } else if (authUser?.user) {
          const { error: userError } = await supabase.from("users").insert({
            id: authUser.user.id,
            email: "test@example.com",
            full_name: "Test User",
          });

          if (userError) {
            results.errors.push(
              `Failed to create test user: ${userError.message}`,
            );
          }
        }
      } catch (error) {
        results.errors.push(
          `Seed data operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      message:
        results.errors.length === 0
          ? "Database initialized successfully"
          : "Database initialization completed with errors",
      results,
    });
  } catch (error) {
    console.error("Database initialization error:", error);

    // Handle validation errors specifically
    if (error instanceof Error && error.name === "ZodError") {
      const validationError = new ValidationError("Invalid input parameters", {
        validationErrors: error.message,
      });
      return NextResponse.json(
        {
          success: false,
          message: validationError.message,
          error: validationError.toJSON(),
        },
        { status: validationError.statusCode },
      );
    }

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to initialize database",
        error: handledError.toJSON(),
      },
      { status: handledError.statusCode },
    );
  }
}
