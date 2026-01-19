import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";

type CreateProjectBody = {
  name?: unknown;
  customerId?: unknown;
};

export async function GET() {
  await connectDB();

  const docs = await Project.find({})
    .select("name customerId createdAt rulesets")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    projects: docs.map((d) => ({
      id: d._id.toString(),
      customerId: d.customerId,
      name: d.name,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : undefined,
      rulesetsCount: d.rulesets?.length || 0,
      latestRuleset: d.rulesets && d.rulesets.length > 0
        ? {
            version: d.rulesets[d.rulesets.length - 1].version,
            versionName: d.rulesets[d.rulesets.length - 1].versionName,
            createdAt: d.rulesets[d.rulesets.length - 1].createdAt,
          }
        : null,
    })),
  });
}

export async function POST(req: Request) {
  let body: CreateProjectBody;
  try {
    body = (await req.json()) as CreateProjectBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 },
    );
  }

  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId) {
    return NextResponse.json(
      { error: "customerId is required" },
      { status: 400 },
    );
  }

  await connectDB();

  const project = await Project.create({ 
    name,
    customerId,
  });

  return NextResponse.json(
    {
      id: project._id.toString(),
      customerId: project.customerId,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
