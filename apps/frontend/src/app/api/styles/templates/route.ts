/**
 * Template Styles API Endpoint
 * GET /api/styles/templates - Get template styles
 */

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: styles, error } = await supabase
      .from("styles")
      .select("*")
      .eq("is_template", true)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to get template styles: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: styles || [],
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/styles/templates] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get template styles",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
