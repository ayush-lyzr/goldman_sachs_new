import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { tryParseJson } from "@/lib/utils";

const AGENT_ID = "696dc951c3a33af8ef0613d8";

interface GapAnalysisRequest {
  projectId: string;
  customerId: string;
  rulesToColumnResponse: string | object;
}

interface ConstraintDelta {
  constraint: string;
  pdf_value: string[];
  fidessa_value: string[];
  delta: string;
  matched: boolean;
}

interface GapAnalysisResponse {
  mapped_rules: ConstraintDelta[];
}

/**
 * Gap Analysis Agent API
 * 
 * POST /api/agents/gap-analysis
 * 
 * Request Body:
 * {
 *   "projectId": "string",                  // Required - MongoDB Project ID
 *   "customerId": "string",                 // Required - Used as session_id for agent
 *   "rulesToColumnResponse": object | string // Required - Response from Rules to Column
 * }
 * 
 * Response:
 * {
 *   "mapped_rules": [
 *     {
 *       "constraint": "Country Restriction",
 *       "pdf_value": [],
 *       "fidessa_value": ["US", "GB", ...],
 *       "delta": "Description of differences...",
 *       "matched": false
 *     }
 *   ]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GapAnalysisRequest;

    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    if (!body.rulesToColumnResponse) {
      return NextResponse.json(
        { error: "rulesToColumnResponse is required" },
        { status: 400 }
      );
    }

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    // Convert object to string if needed
    const message = typeof body.rulesToColumnResponse === "string" 
      ? body.rulesToColumnResponse 
      : JSON.stringify(body.rulesToColumnResponse);

    const response = await callLyzrAgent<GapAnalysisResponse>({
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
    });

    // If the response has a 'response' field (meaning it's a wrapped string), try to parse it
    let parsedResponse: GapAnalysisResponse;
    if ('response' in response && typeof response.response === 'string') {
      const parseResult = tryParseJson<GapAnalysisResponse>(response.response);
      
      if (!parseResult.success) {
        console.error("Failed to parse agent response JSON:", parseResult.parseError);
        console.log("Raw agent response:", parseResult.raw);
        
        return NextResponse.json(parseResult, { status: 500 });
      }
      
      parsedResponse = parseResult.data;
    } else {
      parsedResponse = response as GapAnalysisResponse;
    }

    // Save the gap analysis to the project with versioning
    try {
      await connectDB();
      
      const project = await Project.findOne({ customerId: body.customerId });
      
      if (project) {
        // Find the latest ruleset to update it with gap analysis data
        if (project.rulesets.length > 0) {
          const latestRuleset = project.rulesets[project.rulesets.length - 1];
          
          // Add gap analysis to the latest ruleset's data
          latestRuleset.data.gap_analysis = parsedResponse.mapped_rules;
          
          await project.save();
          
          console.log(`Gap analysis saved successfully to ${latestRuleset.versionName} for customer ${body.customerId}`);
        } else {
          console.error(`No rulesets found for customer ${body.customerId}. Cannot save gap analysis.`);
        }
      } else {
        console.error(`Project not found for customerId: ${body.customerId}`);
      }
    } catch (saveError) {
      // Log but don't fail the request if saving fails
      console.error("Error saving gap analysis:", saveError);
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("Gap Analysis Agent error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
