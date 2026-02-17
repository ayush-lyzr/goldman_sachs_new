import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { tryParseJson } from "@/lib/utils";
import { connectDB } from "@/lib/mongodb";
import ComparisonJob from "@/models/ComparisonJob";

export const runtime = "nodejs";

const AGENT_ID = "696a167ea5272eccb326c2ec";

interface RawRule {
  title: string;
  rules: string[];
}

interface RulesVersionPayload {
  version: number;
  versionName: string;
  createdAt: string;
  raw_rules: RawRule[];
}

interface RulesDiffRequest {
  projectId: string;
  customerId: string;
  versions: RulesVersionPayload[];
}

/**
 * Process comparison job asynchronously
 */
async function processComparisonJob(
  jobId: string,
  body: RulesDiffRequest
): Promise<void> {
  try {
    // Connect to database
    await connectDB();

    // Update job status to processing
    await ComparisonJob.findOneAndUpdate(
      { jobId },
      {
        status: "processing",
        updatedAt: new Date(),
      }
    );

    const apiKey = process.env.LYZR_API_KEY;
    if (!apiKey) {
      throw new Error("LYZR_API_KEY is not configured");
    }

    const message = JSON.stringify({
      projectId: body.projectId,
      customerId: body.customerId,
      versions: body.versions,
    });

    console.log(`[rules-diff] Starting comparison job ${jobId} for ${body.versions.length} versions`);

    const response = await callLyzrAgent({
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
      apiKey,
    });

    // Parse the response
    let parsedResult: any;
    if (
      typeof response === "object" &&
      response !== null &&
      "response" in response &&
      typeof (response as { response?: unknown }).response === "string"
    ) {
      const parseResult = tryParseJson((response as { response: string }).response);

      if (!parseResult.success) {
        console.error(`[rules-diff] Failed to parse response for job ${jobId}:`, parseResult.parseError);
        throw new Error(`Failed to parse agent response: ${parseResult.parseError}`);
      }

      parsedResult = parseResult.data;
    } else {
      parsedResult = response;
    }

    // Update job with result
    await ComparisonJob.findOneAndUpdate(
      { jobId },
      {
        status: "completed",
        result: parsedResult,
        updatedAt: new Date(),
      }
    );

    console.log(`[rules-diff] Comparison job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[rules-diff] Comparison job ${jobId} failed:`, error);
    
    // Update job with error
    try {
      await ComparisonJob.findOneAndUpdate(
        { jobId },
        {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        }
      );
    } catch (updateError) {
      console.error(`[rules-diff] Failed to update job ${jobId} with error status:`, updateError);
    }
  }
}

/**
 * Rules Diff Agent API with Polling Support
 *
 * POST /api/agents/rules-diff
 * - Starts an async comparison job
 * - Returns immediately with jobId
 *
 * GET /api/agents/rules-diff?jobId=<jobId>
 * - Polls for job status
 * - Returns job status and result when completed
 */
export async function POST(req: Request) {
  try {
    // Connect to database
    await connectDB();

    const body = (await req.json()) as RulesDiffRequest;

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!body.customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    if (!Array.isArray(body.versions) || body.versions.length === 0) {
      return NextResponse.json({ error: "versions is required" }, { status: 400 });
    }

    // Generate unique job ID
    const jobId = `${body.customerId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create job record in database
    const job = new ComparisonJob({
      jobId,
      projectId: body.projectId,
      customerId: body.customerId,
      status: "pending",
    });

    await job.save();

    // Start processing asynchronously (don't await)
    processComparisonJob(jobId, body).catch((error) => {
      console.error(`[rules-diff] Unhandled error in job ${jobId}:`, error);
    });

    console.log(`[rules-diff] Created comparison job ${jobId} for ${body.versions.length} versions`);

    // Return jobId immediately
    return NextResponse.json({
      jobId,
      status: "pending",
      message: "Comparison job started. Poll /api/agents/rules-diff?jobId=" + jobId + " for status.",
    });
  } catch (error) {
    console.error("[rules-diff] Error creating comparison job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    // Connect to database
    await connectDB();

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId query parameter is required" }, { status: 400 });
    }

    const job = await ComparisonJob.findOne({ jobId });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Return job status
    const response: any = {
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };

    if (job.status === "completed" && job.result) {
      response.result = job.result;
    }

    if (job.status === "failed" && job.error) {
      response.error = job.error;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[rules-diff] Error polling job status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
