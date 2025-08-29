import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import type { Database } from "@/lib/gen.types";
import { setupStatusSchema } from "@/lib/schemas/setup";
import { createAdminClient } from "@/lib/supabase/server";

interface DatabaseStatus {
  connected: boolean;
  tablesExist: string[];
  tablesMissing: string[];
  totalTables: number;
}

interface StorageStatus {
  connected: boolean;
  bucketsExist: string[];
  bucketsMissing: string[];
  totalBuckets: number;
}

interface SetupStatus {
  overall: "complete" | "partial" | "not_started";
  database: DatabaseStatus;
  storage: StorageStatus;
  errors: string[];
  timestamp: string;
}

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get("includeDetails") === "true";

    const input = setupStatusSchema.parse({ includeDetails });
    const supabase = createAdminClient();

    const status: SetupStatus = {
      overall: "not_started",
      database: {
        connected: false,
        tablesExist: [],
        tablesMissing: [],
        totalTables: 0,
      },
      storage: {
        connected: false,
        bucketsExist: [],
        bucketsMissing: [],
        totalBuckets: 0,
      },
      errors: [],
      timestamp: new Date().toISOString(),
    };

    // Check database connection and tables
    const expectedTables = [
      "teams",
      "users",
      "team_members",
      "sequences",
      "frames",
      "styles",
      "characters",
      "audio",
      "vfx",
    ];

    try {
      status.database.totalTables = expectedTables.length;

      // Check each expected table - this will also test connectivity
      for (const tableName of expectedTables) {
        const exists = await checkTableExists(supabase, tableName);
        if (exists) {
          status.database.tablesExist.push(tableName);
        } else {
          status.database.tablesMissing.push(tableName);
        }
      }

      // If we get here without errors, we're connected
      status.database.connected = true;
    } catch (error) {
      status.database.connected = false;
      status.errors.push(
        `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Check storage buckets
    const expectedBuckets = [
      "thumbnails",
      "videos",
      "characters",
      "styles",
      "audio",
      "scripts",
      "exports",
    ];

    try {
      const { data: buckets, error: bucketsError } =
        await supabase.storage.listBuckets();

      if (bucketsError) {
        throw new Error(bucketsError.message);
      }

      status.storage.connected = true;
      status.storage.totalBuckets = expectedBuckets.length;

      for (const bucketName of expectedBuckets) {
        const exists = buckets?.some((b) => b.id === bucketName);
        if (exists) {
          status.storage.bucketsExist.push(bucketName);
        } else {
          status.storage.bucketsMissing.push(bucketName);
        }
      }
    } catch (error) {
      status.errors.push(
        `Storage connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Determine overall status
    const tablesComplete =
      status.database.tablesMissing.length === 0 &&
      status.database.tablesExist.length > 0;
    const bucketsComplete =
      status.storage.bucketsMissing.length === 0 &&
      status.storage.bucketsExist.length > 0;

    if (tablesComplete && bucketsComplete) {
      status.overall = "complete";
    } else if (
      status.database.tablesExist.length > 0 ||
      status.storage.bucketsExist.length > 0
    ) {
      status.overall = "partial";
    } else {
      status.overall = "not_started";
    }

    // Return minimal response if details not requested
    if (!input.includeDetails) {
      return NextResponse.json({
        success: true,
        status: status.overall,
        database: {
          connected: status.database.connected,
          tablesCount: status.database.tablesExist.length,
          totalTables: status.database.totalTables,
        },
        storage: {
          connected: status.storage.connected,
          bucketsCount: status.storage.bucketsExist.length,
          totalBuckets: status.storage.totalBuckets,
        },
        hasErrors: status.errors.length > 0,
        timestamp: status.timestamp,
      });
    }

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Setup status check error:", error);

    // Handle validation errors specifically
    if (error instanceof Error && error.name === "ZodError") {
      const validationError = new ValidationError("Invalid query parameters", {
        validationErrors: error.message,
      });
      return NextResponse.json(
        {
          success: false,
          message: validationError.message,
          error: validationError.toJSON(),
          timestamp: new Date().toISOString(),
        },
        { status: validationError.statusCode },
      );
    }

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check setup status",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}

export async function POST(request: NextRequest) {
  // Alias for GET request with includeDetails=true for convenience
  const url = new URL(request.url);
  url.searchParams.set("includeDetails", "true");

  const newRequest = new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });

  return GET(newRequest as NextRequest);
}
