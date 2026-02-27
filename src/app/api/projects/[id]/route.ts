import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";

function findProject(id: string) {
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
    return Project.findById(id);
  }
  return Project.findOne({ customerId: id });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const project = await findProject(id)
      .select("name customerId createdAt rulesets selectedCompany")
      .lean();

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
      selectedCompany: project.selectedCompany,
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

type PatchBody = {
  name?: string;
  selectedCompany?: {
    companyId: string;
    companyName: string;
    fidessa_catalog: Record<string, string>;
    fidessa_catalog_v1?: Record<string, string>;
    fidessa_catalog_v2?: Record<string, string>;
    rulesVersion?: "v1" | "v2";
  };
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = (await req.json()) as PatchBody;

    const project = await findProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (typeof body.name === "string" && body.name.trim()) {
      project.name = body.name.trim();
    }
    if (body.selectedCompany != null) {
      project.selectedCompany = body.selectedCompany as any;
    }
    await project.save();

    return NextResponse.json({
      id: project._id.toString(),
      customerId: project.customerId,
      name: project.name,
      selectedCompany: project.selectedCompany,
      createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : undefined,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const project = await findProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await Project.findByIdAndDelete(project._id);
    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
