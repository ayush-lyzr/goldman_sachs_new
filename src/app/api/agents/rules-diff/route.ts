import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { tryParseJson } from "@/lib/utils";

export const runtime = "nodejs";

const AGENT_ID = "696a167ea5272eccb326c2ec";

interface RawRule {
  title: string;
  rules: string[];
}

interface RulesVersionPayload {
  version: number;
  versionName: string;
  createdAt: string;
  raw_rules: RawRule[];
}

interface RulesDiffRequest {
  projectId: string;
  customerId: string;
  versions: RulesVersionPayload[];
}

/**
 * Rules Diff Agent API
 *
 * POST /api/agents/rules-diff
 *
 * This endpoint forwards ALL provided ruleset versions to the rules-diff agent.
 * - session_id is the customerId
 * - Uses RULES_DIFF_API_KEY (NOT LYZR_API_KEY)
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "customerId": "string",
 *   "versions": [
 *     { "version": 1, "versionName": "v1", "createdAt": "ISO", "raw_rules": [...] },
 *     { "version": 2, "versionName": "v2", "createdAt": "ISO", "raw_rules": [...] }
 *   ]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RulesDiffRequest;

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!body.customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    if (!Array.isArray(body.versions) || body.versions.length === 0) {
      return NextResponse.json({ error: "versions is required" }, { status: 400 });
    }

    const apiKey = process.env.RULES_DIFF_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "RULES_DIFF_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const message = JSON.stringify({
      projectId: body.projectId,
      customerId: body.customerId,
      versions: body.versions,
    });

    const response = await callLyzrAgent({
      user_id: "mudit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
      apiKey,
    });

    // If the response has a 'response' field (meaning it's a wrapped string), try to parse it
    if (
      typeof response === "object" &&
      response !== null &&
      "response" in response &&
      typeof (response as { response?: unknown }).response === "string"
    ) {
      const parseResult = tryParseJson((response as { response: string }).response);

      if (!parseResult.success) {
        console.error("Failed to parse rules diff response JSON:", parseResult.parseError);
        console.log("Raw agent response:", parseResult.raw);
        return NextResponse.json(parseResult, { status: 500 });
      }

      return NextResponse.json(parseResult.data);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Rules Diff Agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

