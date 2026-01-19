import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";

/**
 * GET /api/projects/rulesets/[version]?customerId={customerId}
 * 
 * Retrieves a specific ruleset version for a project
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ version: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const { version: versionParam } = await params;
    const version = parseInt(versionParam, 10);

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (isNaN(version)) {
      return NextResponse.json(
        { error: "Invalid version number" },
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

    const ruleset = project.rulesets.find(rs => rs.version === version);

    if (!ruleset) {
      return NextResponse.json(
        { error: "Ruleset version not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      projectName: project.name,
      ruleset: {
        version: ruleset.version,
        versionName: ruleset.versionName,
        createdAt: ruleset.createdAt,
        data: ruleset.data,
      }
    });
  } catch (error) {
    console.error("Get ruleset version error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}
