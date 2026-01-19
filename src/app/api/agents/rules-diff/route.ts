import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";

const AGENT_ID = "696a167ea5272eccb326c2ec";

interface RulesDiffRequest {
  projectId: string;
  customerId: string;
  rulesExtractorResponse: string | object;
  latestRulesFromDB: string | object;
}

interface RuleDiff {
  status: "UNCHANGED" | "MODIFIED" | "NEW" | "REMOVED";
  previous: string | null;
  current: string | null;
}

interface RulesDiffResponse {
  rules: RuleDiff[];
}

/**
 * Rules Diff Agent API
 * 
 * POST /api/agents/rules-diff
 * 
 * Request Body:
 * {
 *   "projectId": "string",                    // Required - MongoDB Project ID
 *   "customerId": "string",                   // Required - Used as session_id for agent
 *   "rulesExtractorResponse": object | string, // Required - Current rules from extractor
 *   "latestRulesFromDB": object | string       // Required - Previous rules from database
 * }
 * 
 * Response:
 * {
 *   "rules": [
 *     {
 *       "status": "UNCHANGED" | "MODIFIED" | "NEW" | "REMOVED",
 *       "previous": "Previous rule text or null",
 *       "current": "Current rule text or null"
 *     }
 *   ]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RulesDiffRequest;

    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    if (!body.rulesExtractorResponse) {
      return NextResponse.json(
        { error: "rulesExtractorResponse is required" },
        { status: 400 }
      );
    }

    if (!body.latestRulesFromDB) {
      return NextResponse.json(
        { error: "latestRulesFromDB is required" },
        { status: 400 }
      );
    }

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    // Convert objects to strings if needed
    const rulesExtractor = typeof body.rulesExtractorResponse === "string" 
      ? body.rulesExtractorResponse 
      : JSON.stringify(body.rulesExtractorResponse);

    const latestRules = typeof body.latestRulesFromDB === "string" 
      ? body.latestRulesFromDB 
      : JSON.stringify(body.latestRulesFromDB);

    // Combine both inputs into a single message
    const message = JSON.stringify({
      current_rules: rulesExtractor,
      previous_rules: latestRules,
    });

    const response = await callLyzrAgent<RulesDiffResponse>({
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Rules Diff Agent error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
