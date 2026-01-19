import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    console.log("Fetching project with customerId:", id);

    const project = await Project.findOne({ customerId: id })
      .select("name customerId createdAt rulesets")
      .lean();

    console.log("Project found:", project);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: project._id.toString(),
      customerId: project.customerId,
      name: project.name,
      createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : undefined,
      rulesetsCount: project.rulesets?.length || 0,
      latestRuleset: project.rulesets && project.rulesets.length > 0
        ? {
            version: project.rulesets[project.rulesets.length - 1].version,
            versionName: project.rulesets[project.rulesets.length - 1].versionName,
            createdAt: project.rulesets[project.rulesets.length - 1].createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
