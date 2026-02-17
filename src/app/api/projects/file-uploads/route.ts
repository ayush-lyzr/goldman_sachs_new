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

    // Retry logic for handling version conflicts
    const maxRetries = 5;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Fetch fresh project document on each retry
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

        // Check if file upload already exists (by filename)
        const existingUploadIndex = project.fileUploads.findIndex(
          (upload) => upload.filename === body.filename
        );

        if (existingUploadIndex >= 0) {
          // Update existing file upload
          console.log("[file-uploads POST] Updating existing file upload at index:", existingUploadIndex);
          if (body.rulesetVersion !== undefined) {
            project.fileUploads[existingUploadIndex].rulesetVersion = body.rulesetVersion;
          }
          // Update other fields if provided
          if (body.markdown) {
            project.fileUploads[existingUploadIndex].markdown = body.markdown;
          }
          if (body.fileType) {
            project.fileUploads[existingUploadIndex].fileType = body.fileType;
          }
        } else {
          // Create new file upload
          console.log("[file-uploads POST] Creating new file upload. Current count:", project.fileUploads.length);
          project.fileUploads.push(fileUpload);
        }

        project.markModified('fileUploads');
        
        console.log("[file-uploads POST] Saving project... (attempt", retryCount + 1, ")");
        await project.save();
        console.log("[file-uploads POST] Project saved successfully. Total fileUploads count:", project.fileUploads.length);
        
        // Success - break out of retry loop
        break;
      } catch (error: any) {
        lastError = error;
        // Check if it's a version conflict error
        if (error?.message?.includes("No matching document found") || error?.name === "VersionError") {
          retryCount++;
          if (retryCount < maxRetries) {
            // Exponential backoff: wait 50ms, 100ms, 200ms, 400ms, 800ms
            const waitTime = Math.min(50 * Math.pow(2, retryCount - 1), 800);
            console.log(`[file-uploads POST] Version conflict detected (attempt ${retryCount}/${maxRetries}). Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry
          } else {
            console.error("[file-uploads POST] Max retries reached for version conflict");
            throw error; // Re-throw after max retries
          }
        } else {
          // Not a version conflict - throw immediately
          throw error;
        }
      }
    }

    if (lastError && retryCount >= maxRetries) {
      throw lastError;
    }

    // Get the final file upload data for response
    const finalProject = await Project.findOne({ customerId: body.customerId });
    const finalFileUpload = finalProject?.fileUploads?.find(
      (upload) => upload.filename === body.filename
    );

    if (!finalFileUpload) {
      return NextResponse.json(
        { error: "File upload not found after save" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        fileUpload: {
          filename: finalFileUpload.filename,
          fileType: finalFileUpload.fileType,
          markdown: finalFileUpload.markdown,
          uploadedAt: finalFileUpload.uploadedAt instanceof Date 
            ? finalFileUpload.uploadedAt.toISOString() 
            : finalFileUpload.uploadedAt,
          rulesetVersion: finalFileUpload.rulesetVersion,
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
