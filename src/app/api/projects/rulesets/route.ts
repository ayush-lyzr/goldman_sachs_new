import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";

interface SaveRulesetRequest {
  customerId: string;
  versionName?: string;
  data: {
    mapped_rules?: Array<{
      constraint: string;
      sentinel_allowed_values: string[];
      rules: string[];
    }>;
    raw_rules?: Array<{
      title: string;
      rules: string[];
    }>;
  };
}

/**
 * POST /api/projects/rulesets
 * 
 * Saves a new ruleset version for a project identified by customerId.
 * Automatically increments the version number.
 * 
 * Request Body:
 * {
 *   "customerId": "string",        // Required - Project identifier
 *   "versionName": "string",       // Optional - Custom version name (defaults to "v{version}")
 *   "data": {                      // Required - Ruleset data
 *     "mapped_rules": [...],       // Optional - Mapped rules from rules-to-column agent
 *     "raw_rules": [...]           // Optional - Raw rules from rules-extractor agent
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "version": number,
 *   "versionName": "string",
 *   "createdAt": "ISO date string"
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveRulesetRequest;

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!body.data) {
      return NextResponse.json(
        { error: "data is required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Find the project by customerId
    const project = await Project.findOne({ customerId: body.customerId });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Calculate version based on file upload order: first file = v1, second = v2, etc.
    // Use the number of file uploads as the version number (1-indexed)
    const fileUploadsCount = project.fileUploads?.length || 0;
    const nextVersion = fileUploadsCount > 0 ? fileUploadsCount : 1;

    // Create version name
    const versionName = body.versionName || `v${nextVersion}`;

    // Add the new ruleset
    const newRuleset = {
      version: nextVersion,
      versionName,
      createdAt: new Date(),
      data: body.data,
    };

    project.rulesets.push(newRuleset);
    await project.save();

    return NextResponse.json(
      {
        success: true,
        version: nextVersion,
        versionName,
        createdAt: newRuleset.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Save ruleset error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/rulesets?customerId={customerId}
 * 
 * Retrieves all rulesets for a project
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const project = await Project.findOne({ customerId }).select("rulesets name").lean();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      projectName: project.name,
      rulesets: project.rulesets.map(rs => ({
        version: rs.version,
        versionName: rs.versionName,
        createdAt: rs.createdAt,
        dataPreview: {
          hasMappedRules: !!rs.data.mapped_rules && rs.data.mapped_rules.length > 0,
          hasRawRules: !!rs.data.raw_rules && rs.data.raw_rules.length > 0,
          mappedRulesCount: rs.data.mapped_rules?.length || 0,
          rawRulesCount: rs.data.raw_rules?.length || 0,
        }
      }))
    });
  } catch (error) {
    console.error("Get rulesets error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}
