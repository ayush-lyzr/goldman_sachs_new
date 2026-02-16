import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";

interface SaveFileUploadRequest {
  customerId: string;
  filename: string;
  fileType: string;
  markdown: string;
  rulesetVersion?: number;
}

/**
 * POST /api/projects/file-uploads
 * 
 * Saves a file upload record for a project
 */
export async function POST(req: Request) {
  try {
    console.log("[file-uploads POST] Request received");
    const body = (await req.json()) as SaveFileUploadRequest;

    console.log("[file-uploads POST] Request body:", {
      customerId: body.customerId,
      filename: body.filename,
      fileType: body.fileType,
      markdownLength: body.markdown?.length,
      hasRulesetVersion: !!body.rulesetVersion,
    });

    if (!body.customerId || !body.filename || !body.fileType || !body.markdown) {
      console.error("[file-uploads POST] Missing required fields:", {
        hasCustomerId: !!body.customerId,
        hasFilename: !!body.filename,
        hasFileType: !!body.fileType,
        hasMarkdown: !!body.markdown,
      });
      return NextResponse.json(
        { error: "customerId, filename, fileType, and markdown are required" },
        { status: 400 }
      );
    }

    await connectDB();
    console.log("[file-uploads POST] Database connected");

    const project = await Project.findOne({ customerId: body.customerId });
    console.log("[file-uploads POST] Project found:", !!project);

    if (!project) {
      console.error("[file-uploads POST] Project not found for customerId:", body.customerId);
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const fileUpload = {
      filename: body.filename,
      fileType: body.fileType,
      markdown: body.markdown,
      uploadedAt: new Date(),
      rulesetVersion: body.rulesetVersion,
    };

    // Ensure fileUploads array exists
    if (!project.fileUploads) {
      project.fileUploads = [];
      console.log("[file-uploads POST] Initialized fileUploads array");
    }

    console.log("[file-uploads POST] Current fileUploads count:", project.fileUploads.length);
    project.fileUploads.push(fileUpload);
    project.markModified('fileUploads');
    
    console.log("[file-uploads POST] Saving project...");
    await project.save();
    console.log("[file-uploads POST] Project saved successfully. New fileUploads count:", project.fileUploads.length);

    return NextResponse.json(
      {
        success: true,
        fileUpload: {
          ...fileUpload,
          uploadedAt: fileUpload.uploadedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Save file upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/file-uploads?customerId={customerId}
 * 
 * Retrieves all file uploads for a project
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

    const project = await Project.findOne({ customerId })
      .select("fileUploads rulesets")
      .lean();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Ensure fileUploads exists (for projects created before this feature)
    const uploads = project.fileUploads || [];

    // Map file uploads with associated ruleset info
    const fileUploads = uploads.map((upload) => {
      const ruleset = upload.rulesetVersion
        ? project.rulesets?.find((rs) => rs.version === upload.rulesetVersion)
        : null;

      return {
        filename: upload.filename,
        fileType: upload.fileType,
        markdown: upload.markdown,
        uploadedAt: upload.uploadedAt instanceof Date 
          ? upload.uploadedAt.toISOString() 
          : upload.uploadedAt,
        rulesetVersion: upload.rulesetVersion,
        ruleset: ruleset
          ? {
              version: ruleset.version,
              versionName: ruleset.versionName,
              createdAt: ruleset.createdAt instanceof Date
                ? ruleset.createdAt.toISOString()
                : ruleset.createdAt,
              hasRawRules: !!ruleset.data?.raw_rules && ruleset.data.raw_rules.length > 0,
              hasMappedRules: !!ruleset.data?.mapped_rules && ruleset.data.mapped_rules.length > 0,
              hasGapAnalysis: !!ruleset.data?.gap_analysis && ruleset.data.gap_analysis.length > 0,
            }
          : null,
      };
    });

    return NextResponse.json({
      fileUploads: fileUploads.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ),
    });
  } catch (error) {
    console.error("Get file uploads error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}
