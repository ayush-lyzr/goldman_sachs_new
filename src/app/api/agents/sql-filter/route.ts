import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { tryParseJson } from "@/lib/utils";

const AGENT_ID = "696df37ec3a33af8ef061d83";

interface ConstraintFilter {
  constraint: string;
  pdf_value: string[];
}

interface SQLFilterRequest {
  customerId: string;
  message: string;
}

interface SQLFilterResponse {
  count: string;
}

/**
 * SQL Filter Agent API
 * 
 * POST /api/agents/sql-filter
 * 
 * This endpoint calls the SQL agent to get the count of securities
 * that match the given constraints. The message should be formatted as
 * natural language text.
 * 
 * Request Body:
 * {
 *   "customerId": "demo-customer-123",
 *   "message": "give count for Instrument_Type is Sovereign, Corporate and Composite_Rating is AAA, AA+"
 * }
 * 
 * Example messages:
 * - Single: "give count for Instrument_Type is Sovereign, Supranational, Agency, Corporate"
 * - Two: "give count for Instrument_Type is Sovereign, Corporate and Composite_Rating is AAA, AA+"
 * - Three: "give count for Instrument_Type is Sovereign, Corporate and Composite_Rating is AAA, AA+ and IG_Flag is Yes"
 * 
 * Response:
 * {
 *   "count": 9024
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SQLFilterRequest;

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!body.message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    console.log(`SQL Filter Agent: Calling for session ${body.customerId}`);
    console.log("Message:", body.message);

    const response = await callLyzrAgent<SQLFilterResponse>({
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message: body.message,
    });

    // Handle response parsing
    let parsedCount: number;
    
    if ('response' in response && typeof response.response === 'string') {
      // Try to parse the response string
      const parseResult = tryParseJson<SQLFilterResponse>(response.response);
      
      if (parseResult.success) {
        parsedCount = parseInt(parseResult.data.count, 10);
      } else {
        // Try direct extraction if it's just a number
        const match = response.response.match(/\d+/);
        if (match) {
          parsedCount = parseInt(match[0], 10);
        } else {
          console.error("Failed to parse SQL filter response:", response.response);
          return NextResponse.json(
            { error: "Failed to parse agent response", raw: response.response },
            { status: 500 }
          );
        }
      }
    } else if ('count' in response) {
      parsedCount = parseInt(String(response.count), 10);
    } else {
      console.error("Unexpected response format:", response);
      return NextResponse.json(
        { error: "Unexpected response format", raw: response },
        { status: 500 }
      );
    }

    console.log(`SQL Filter Agent: Got count ${parsedCount}`);

    return NextResponse.json({ count: parsedCount });
  } catch (error) {
    console.error("SQL Filter Agent error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
