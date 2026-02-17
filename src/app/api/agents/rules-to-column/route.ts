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
  fileId?: string; // Unique file ID to identify the file upload
  filename?: string; // Optional - used for logging and fallback
}

interface MappedRule {
  constraint: string;
  sentinel_allowed_values: string[];
  rules: string[];
}

interface RulesToColumnResponse {
  mapped_rules: MappedRule[];
  version?: number; // Version assigned to this ruleset
  versionName?: string; // e.g., "v1", "v2"
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
    let assignedVersion: number | undefined;
    let assignedVersionName: string | undefined;
    
    // Retry logic for handling concurrent updates
    const maxRetries = 5;
    let retryCount = 0;
    let saveSuccess = false;
    
    while (!saveSuccess && retryCount < maxRetries) {
      try {
        await connectDB();
        
        console.log(`[rules-to-column] Looking for project with customerId: ${body.customerId} (attempt ${retryCount + 1})`);
        const project = await Project.findOne({ customerId: body.customerId });
      
      if (project) {
        console.log(`[rules-to-column] Found project: ${project.name}, current rulesets count: ${project.rulesets?.length || 0}`);
        
        // Find the file upload by unique fileId FIRST
        let fileUpload = null;
        if (body.fileId && project.fileUploads && project.fileUploads.length > 0) {
          fileUpload = project.fileUploads.find(
            (upload) => upload.fileId === body.fileId
          );
        } else if (body.filename && project.fileUploads && project.fileUploads.length > 0) {
          // Fallback: Find by filename if fileId not provided
          fileUpload = project.fileUploads.find(
            (upload) => upload.filename === body.filename
          );
        }
        
        // CRITICAL: If this file already has a version, ALWAYS use it (no new versions)
        let nextVersion: number;
        if (fileUpload && fileUpload.rulesetVersion) {
          nextVersion = fileUpload.rulesetVersion;
          console.log(`[rules-to-column] File ID "${body.fileId}" already has version ${nextVersion}. RETURNING EXISTING VERSION - NO NEW VERSION WILL BE CREATED.`);
          
          // Return immediately with existing version - don't create/update anything
          assignedVersion = nextVersion;
          assignedVersionName = `v${nextVersion}`;
          saveSuccess = true;
          break; // Exit retry loop immediately
        }
        
        // File doesn't have a version yet - assign one based on database
        // Find the highest version number from existing rulesets
        let maxVersion = 0;
        if (project.rulesets && project.rulesets.length > 0) {
          maxVersion = Math.max(...project.rulesets.map(rs => rs.version || 0));
        }
        nextVersion = maxVersion + 1;
        console.log(`[rules-to-column] Current max version in database: ${maxVersion}`);
        console.log(`[rules-to-column] Assigning NEW version ${nextVersion} to file ID "${body.fileId}" (${body.filename})`);
        console.log(`[rules-to-column] THIS IS A NEW VERSION - will create new ruleset`);


        // Create version name
        const versionName = `v${nextVersion}`;
        
        // Store the assigned version to return in the response
        assignedVersion = nextVersion;
        assignedVersionName = versionName;
        
        // Check if a ruleset with this version already exists
        const existingRuleset = project.rulesets.find(rs => rs.version === nextVersion);
        
        if (existingRuleset) {
          console.log(`[rules-to-column] ERROR: Ruleset v${nextVersion} already exists! This should not happen.`);
          console.log(`[rules-to-column] This means version assignment logic is broken or API was called multiple times.`);
          // Don't update or create - just skip to avoid duplicates
          saveSuccess = true;
          break;
        } else {
          console.log(`[rules-to-column] Creating new ruleset ${versionName}`);

          // Extract raw_rules from the request
          const rawRules = typeof body.rulesExtractorResponse === "object" 
            ? (body.rulesExtractorResponse as { rules?: Array<{ title: string; rules: string[] }> }).rules
            : undefined;

          console.log(`[rules-to-column] Creating ${versionName} with mapped_rules: ${parsedResponse.mapped_rules?.length || 0}, raw_rules: ${rawRules?.length || 0}`);
          console.log(`[rules-to-column] Total rulesets before adding: ${project.rulesets.length}`);

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
          console.log(`[rules-to-column] Total rulesets after adding: ${project.rulesets.length}, versions: ${project.rulesets.map(r => r.version).join(', ')}`);
        }
        
        // Link the file upload to this ruleset version (if not already linked)
        if (fileUpload && !fileUpload.rulesetVersion) {
          fileUpload.rulesetVersion = nextVersion;
          project.markModified('fileUploads');
          console.log(`[rules-to-column] Linked file upload (ID: ${body.fileId || 'unknown'}, name: "${body.filename}") to version ${nextVersion}`);
        }
        
        // Mark the rulesets array as modified to ensure Mongoose detects the change
        project.markModified('rulesets');
        
        await project.save();
        
        console.log(`[rules-to-column] Ruleset saved successfully: ${versionName} for customer ${body.customerId}. Total rulesets: ${project.rulesets.length}`);
        saveSuccess = true;
      } else {
        console.error(`[rules-to-column] Project not found for customerId: ${body.customerId}`);
        saveSuccess = true; // Don't retry if project not found
      }
    } catch (saveError: any) {
      retryCount++;
      
      // Check if it's a version conflict error
      const isVersionError = saveError?.name === 'VersionError' || 
                            saveError?.message?.includes('No matching document found');
      
      if (isVersionError && retryCount < maxRetries) {
        console.warn(`[rules-to-column] Version conflict detected (attempt ${retryCount}/${maxRetries}). Retrying...`);
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount - 1)));
        continue;
      }
      
      // Log detailed error information
      console.error("[rules-to-column] Error saving ruleset:", saveError);
      console.error("[rules-to-column] Error details:", {
        customerId: body.customerId,
        message: saveError instanceof Error ? saveError.message : String(saveError),
        stack: saveError instanceof Error ? saveError.stack : undefined,
        retryCount,
      });
      
      // If we've exhausted retries or it's not a version error, stop retrying
      if (!isVersionError || retryCount >= maxRetries) {
        saveSuccess = true; // Exit the retry loop
      }
    }
  }

    // Return the response with the assigned version
    const responseWithVersion: RulesToColumnResponse = {
      ...parsedResponse,
      version: assignedVersion,
      versionName: assignedVersionName,
    };
    
    return NextResponse.json(responseWithVersion);
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
