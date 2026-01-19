import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { tryParseJson } from "@/lib/utils";

const AGENT_ID = "6969fcb6a5272eccb326c024";

interface RulesExtractorRequest {
  projectId: string;
  customerId: string;
  extractorResponse: string;
}

interface Rule {
  title: string;
  rules: string[];
}

interface RulesExtractorResponse {
  rules: Rule[];
}

/**
 * Rules Extractor Agent API
 * 
 * POST /api/agents/rules-extractor
 * 
 * Request Body:
 * {
 *   "projectId": "string",        // Required - MongoDB Project ID
 *   "customerId": "string",       // Required - Used as session_id for agent
 *   "extractorResponse": "string" // Required - Raw text from PDF extractor
 * }
 * 
 * Response:
 * {
 *   "rules": [
 *     {
 *       "title": "Category Name",
 *       "rules": ["Rule 1", "Rule 2"]
 *     }
 *   ]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RulesExtractorRequest;

    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    if (!body.extractorResponse) {
      return NextResponse.json(
        { error: "extractorResponse is required" },
        { status: 400 }
      );
    }

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const response = await callLyzrAgent<RulesExtractorResponse>({
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message: body.extractorResponse,
    });

    // If the response has a 'response' field (meaning it's a wrapped string), try to parse it
    if ('response' in response && typeof response.response === 'string') {
      const parseResult = tryParseJson(response.response);
      
      if (!parseResult.success) {
        console.error("Failed to parse agent response JSON:", parseResult.parseError);
        console.log("Raw agent response:", parseResult.raw);
        
        // Return the error with detailed information
        return NextResponse.json(parseResult, { status: 500 });
      }
      
      return NextResponse.json(parseResult.data);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Rules Extractor Agent error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
