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
  filename?: string; // Optional - used to find the file upload and determine version
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
      
      console.log(`[rules-to-column] Looking for project with customerId: ${body.customerId}`);
      const project = await Project.findOne({ customerId: body.customerId });
      
      if (project) {
        console.log(`[rules-to-column] Found project: ${project.name}, current rulesets count: ${project.rulesets?.length || 0}`);
        
        // Calculate version based on file upload order: first file = v1, second = v2, etc.
        // If filename is provided, find the file upload and use its index in the array
        // Otherwise, use the total count (for backward compatibility)
        let nextVersion: number;
        let fileUpload = null;
        
        if (body.filename && project.fileUploads && project.fileUploads.length > 0) {
          // Find the file upload by filename
          const fileUploadIndex = project.fileUploads.findIndex(
            (upload) => upload.filename === body.filename
          );
          if (fileUploadIndex >= 0) {
            fileUpload = project.fileUploads[fileUploadIndex];
            // If file upload already has a rulesetVersion, use that instead of creating a new one
            if (fileUpload.rulesetVersion) {
              nextVersion = fileUpload.rulesetVersion;
              console.log(`[rules-to-column] File upload "${body.filename}" already has rulesetVersion ${nextVersion}. Updating existing ruleset.`);
            } else {
              // Use index + 1 (1-indexed) as the version
              nextVersion = fileUploadIndex + 1;
              console.log(`[rules-to-column] Found file upload "${body.filename}" at index ${fileUploadIndex}, assigning version v${nextVersion}`);
            }
          } else {
            // File upload not found, use total count
            nextVersion = project.fileUploads.length;
            console.log(`[rules-to-column] File upload "${body.filename}" not found, using total count: v${nextVersion}`);
          }
        } else {
          // No filename provided, use total count (backward compatibility)
          const fileUploadsCount = project.fileUploads?.length || 0;
          nextVersion = fileUploadsCount > 0 ? fileUploadsCount : 1;
          console.log(`[rules-to-column] No filename provided, using total count: v${nextVersion}`);
        }

        // Create version name
        const versionName = `v${nextVersion}`;
        
        // Check if a ruleset with this version already exists
        const existingRuleset = project.rulesets.find(rs => rs.version === nextVersion);
        
        if (existingRuleset) {
          console.log(`[rules-to-column] Ruleset version ${nextVersion} already exists. Updating existing ruleset instead of creating duplicate.`);
          
          // Update existing ruleset instead of creating a new one
          existingRuleset.data.mapped_rules = parsedResponse.mapped_rules || [];
          const rawRules = typeof body.rulesExtractorResponse === "object" 
            ? (body.rulesExtractorResponse as { rules?: Array<{ title: string; rules: string[] }> }).rules
            : undefined;
          if (rawRules) {
            existingRuleset.data.raw_rules = rawRules;
          }
          project.markModified('rulesets');
        } else {
          console.log(`[rules-to-column] Assigning version ${versionName} based on file upload order`);

          // Extract raw_rules from the request
          const rawRules = typeof body.rulesExtractorResponse === "object" 
            ? (body.rulesExtractorResponse as { rules?: Array<{ title: string; rules: string[] }> }).rules
            : undefined;

          console.log(`[rules-to-column] Creating ${versionName} with mapped_rules: ${parsedResponse.mapped_rules?.length || 0}, raw_rules: ${rawRules?.length || 0}`);

          // Add the new ruleset
          const newRuleset = {
            version: nextVersion,
            versionName,
            createdAt: new Date(),
            data: {
              mapped_rules: parsedResponse.mapped_rules || [],
              raw_rules: rawRules || [],
            },
          };

          project.rulesets.push(newRuleset);
        }
        
        // Link the file upload to this ruleset version (if not already linked)
        if (body.filename && fileUpload && !fileUpload.rulesetVersion) {
          fileUpload.rulesetVersion = nextVersion;
          project.markModified('fileUploads');
          console.log(`[rules-to-column] Linked file upload "${body.filename}" to version ${nextVersion}`);
        } else if (!body.filename && project.fileUploads && project.fileUploads.length > 0) {
          // Fallback: link the latest file upload (backward compatibility)
          const latestUpload = project.fileUploads[project.fileUploads.length - 1];
          if (latestUpload && !latestUpload.rulesetVersion) {
            latestUpload.rulesetVersion = nextVersion;
            project.markModified('fileUploads');
            console.log(`[rules-to-column] Linked latest file upload to version ${nextVersion}`);
          }
        }
        
        // Mark the rulesets array as modified to ensure Mongoose detects the change
        project.markModified('rulesets');
        
        await project.save();
        
        console.log(`[rules-to-column] Ruleset saved successfully: ${versionName} for customer ${body.customerId}. Total rulesets: ${project.rulesets.length}`);
      } else {
        console.error(`[rules-to-column] Project not found for customerId: ${body.customerId}`);
      }
    } catch (saveError) {
      // Log detailed error information
      console.error("[rules-to-column] Error saving ruleset:", saveError);
      console.error("[rules-to-column] Error details:", {
        customerId: body.customerId,
        message: saveError instanceof Error ? saveError.message : String(saveError),
        stack: saveError instanceof Error ? saveError.stack : undefined,
      });
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
