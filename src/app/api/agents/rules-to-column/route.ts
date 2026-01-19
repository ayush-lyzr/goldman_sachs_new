import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { tryParseJson } from "@/lib/utils";

const AGENT_ID = "696a7f8f9ea90559bbf3f1d0";

interface RulesToColumnRequest {
  projectId: string;
  customerId: string;
  rulesExtractorResponse: string | object;
}

interface MappedRule {
  constraint: string;
  sentinel_allowed_values: string[];
  rules: string[];
}

interface RulesToColumnResponse {
  mapped_rules: MappedRule[];
}

/**
 * Rules to Column Agent API
 * 
 * POST /api/agents/rules-to-column
 * 
 * Request Body:
 * {
 *   "projectId": "string",                    // Required - MongoDB Project ID
 *   "customerId": "string",                   // Required - Used as session_id for agent
 *   "rulesExtractorResponse": object | string // Required - Response from Rules Extractor
 * }
 * 
 * Response:
 * {
 *   "mapped_rules": [
 *     {
 *       "constraint": "Sector",
 *       "sentinel_allowed_values": ["!Energy"],
 *       "rules": ["Rule text..."]
 *     }
 *   ]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RulesToColumnRequest;

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

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    // Convert object to string if needed
    const message = typeof body.rulesExtractorResponse === "string" 
      ? body.rulesExtractorResponse 
      : JSON.stringify(body.rulesExtractorResponse);

    const response = await callLyzrAgent<RulesToColumnResponse>({
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
    });

    // If the response has a 'response' field (meaning it's a wrapped string), try to parse it
    let parsedResponse: RulesToColumnResponse;
    if ('response' in response && typeof response.response === 'string') {
      const parseResult = tryParseJson<RulesToColumnResponse>(response.response);
      
      if (!parseResult.success) {
        console.error("Failed to parse agent response JSON:", parseResult.parseError);
        console.log("Raw agent response:", parseResult.raw);
        
        return NextResponse.json(parseResult, { status: 500 });
      }
      
      parsedResponse = parseResult.data;
    } else {
      parsedResponse = response as RulesToColumnResponse;
    }

    // Save the ruleset to the project with versioning
    try {
      await connectDB();
      
      const project = await Project.findOne({ customerId: body.customerId });
      
      if (project) {
        // Calculate the next version number
        const nextVersion = project.rulesets.length > 0
          ? Math.max(...project.rulesets.map(rs => rs.version)) + 1
          : 1;

        // Create version name
        const versionName = `v${nextVersion}`;

        // Add the new ruleset
        const newRuleset = {
          version: nextVersion,
          versionName,
          createdAt: new Date(),
          data: {
            mapped_rules: parsedResponse.mapped_rules,
            raw_rules: typeof body.rulesExtractorResponse === "object" 
              ? (body.rulesExtractorResponse as { rules?: Array<{ title: string; rules: string[] }> }).rules
              : undefined,
          },
        };

        project.rulesets.push(newRuleset);
        await project.save();
        
        console.log(`Ruleset saved successfully: ${versionName} for customer ${body.customerId}`);
      } else {
        console.error(`Project not found for customerId: ${body.customerId}`);
      }
    } catch (saveError) {
      // Log but don't fail the request if saving fails
      console.error("Error saving ruleset:", saveError);
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("Rules to Column Agent error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
