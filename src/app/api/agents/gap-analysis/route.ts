import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { tryParseJson } from "@/lib/utils";

const AGENT_ID = "696dc951c3a33af8ef0613d8";

interface FidessaCatalog {
  Issuer_Country?: string;
  Coupon_Rate?: string;
  Sector?: string;
  Instrument_Type?: string;
  Composite_Rating?: string;
  IG_Flag?: string;
  Days_to_Maturity?: string;
  Shariah_Compliant?: string;
  [key: string]: string | undefined;
}

interface GapAnalysisRequest {
  projectId: string;
  customerId: string;
  rulesToColumnResponse: string | object;
  fidessa_catalog?: FidessaCatalog;
  rulesetVersion?: number; // Specific version to update with gap analysis
}

interface ConstraintDelta {
  constraint: string;
  // Newer agent response shape
  allowed_values?: string[];
  not_allowed_values?: string[];
  match_count?: string | null;
  // Backwards compatible shape (older agent response)
  pdf_value?: string[];
  fidessa_value?: string[];
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
 *       "allowed_values": [],
 *       "not_allowed_values": ["US", "GB", ...],
 *       "match_count": "1/12",
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

    // Build the Lyzr agent request
    const agentRequest: Parameters<typeof callLyzrAgent>[0] = {
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
    };

    // Add system_prompt_variables with fidessa_catalog if provided
    if (body.fidessa_catalog) {
      // Convert the catalog to a string format for the agent
      const catalogString = JSON.stringify(body.fidessa_catalog);
      agentRequest.system_prompt_variables = {
        fidessa_catalog: catalogString,
      };
      console.log("[gap-analysis] Using customer fidessa_catalog:", body.fidessa_catalog);
    } else {
      console.log("[gap-analysis] No fidessa_catalog provided - gap analysis will proceed without customer catalog");
    }

    const response = await callLyzrAgent<GapAnalysisResponse>(agentRequest);

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
    // Retry logic for handling concurrent updates
    const maxRetries = 5;
    let retryCount = 0;
    let saveSuccess = false;
    
    while (!saveSuccess && retryCount < maxRetries) {
      try {
        await connectDB();
        
        console.log(`[gap-analysis] Looking for project with customerId: ${body.customerId} (attempt ${retryCount + 1})`);
        const project = await Project.findOne({ customerId: body.customerId });
        
        if (project) {
          if (project.rulesets.length > 0) {
            // Find the specific ruleset version to update
            let targetRuleset;
            if (body.rulesetVersion !== undefined) {
              // Use the provided version number
              targetRuleset = project.rulesets.find(rs => rs.version === body.rulesetVersion);
              if (!targetRuleset) {
                console.error(`Ruleset version ${body.rulesetVersion} not found for customer ${body.customerId}`);
              }
            } else {
              // Fallback to latest ruleset if no version specified
              targetRuleset = project.rulesets[project.rulesets.length - 1];
            }
            
            if (targetRuleset) {
              // Add gap analysis to the target ruleset's data
              targetRuleset.data.gap_analysis = parsedResponse.mapped_rules;
              project.markModified('rulesets');
              
              await project.save();
              
              console.log(`Gap analysis saved successfully to ${targetRuleset.versionName} (v${targetRuleset.version}) for customer ${body.customerId}`);
              saveSuccess = true;
            } else {
              saveSuccess = true; // No target ruleset, don't retry
            }
          } else {
            console.error(`No rulesets found for customer ${body.customerId}. Cannot save gap analysis.`);
            saveSuccess = true; // No rulesets, don't retry
          }
        } else {
          console.error(`Project not found for customerId: ${body.customerId}`);
          saveSuccess = true; // Project not found, don't retry
        }
      } catch (saveError: any) {
        retryCount++;
        
        // Check if it's a version conflict error
        const isVersionError = saveError?.name === 'VersionError' || 
                              saveError?.message?.includes('No matching document found');
        
        if (isVersionError && retryCount < maxRetries) {
          console.warn(`[gap-analysis] Version conflict detected (attempt ${retryCount}/${maxRetries}). Retrying...`);
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount - 1)));
          continue;
        }
        
        // Log but don't fail the request if saving fails
        console.error("Error saving gap analysis:", saveError);
        console.error("Error details:", {
          customerId: body.customerId,
          rulesetVersion: body.rulesetVersion,
          retryCount,
        });
        
        // If we've exhausted retries or it's not a version error, stop retrying
        if (!isVersionError || retryCount >= maxRetries) {
          saveSuccess = true; // Exit the retry loop
        }
      }
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
