import { NextResponse } from "next/server";
import { callLyzrAgent } from "@/lib/lyzr";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import GapAnalysisJob from "@/models/GapAnalysisJob";
import { tryParseJson } from "@/lib/utils";

export const runtime = "nodejs";

const AGENT_ID = "696dc951c3a33af8ef0613d8";

interface FidessaCatalog {
  Issuer_Country?: string;
  Coupon_Rate?: string;
  Sector?: string;
  Instrument_Type?: string;
  Composite_Rating?: string;
  IG_Flag?: string;
  Days_to_Maturity?: string;
  Shariah_Compliant?: string;
  [key: string]: string | undefined;
}

interface GapAnalysisRequest {
  projectId: string;
  customerId: string;
  rulesToColumnResponse: string | object;
  fidessa_catalog?: FidessaCatalog;
  rulesetVersion?: number;
}

interface ConstraintDelta {
  constraint: string;
  allowed_values?: string[];
  not_allowed_values?: string[];
  match_count?: string | null;
  pdf_value?: string[];
  fidessa_value?: string[];
  delta: string;
  matched: boolean;
}

interface GapAnalysisResponse {
  mapped_rules: ConstraintDelta[];
}

/**
 * Run gap analysis and save to project. Used by the async job processor.
 */
async function processGapAnalysisJob(
  jobId: string,
  body: GapAnalysisRequest
): Promise<void> {
  try {
    await connectDB();

    await GapAnalysisJob.findOneAndUpdate(
      { jobId },
      { status: "processing", updatedAt: new Date() }
    );

    const message =
      typeof body.rulesToColumnResponse === "string"
        ? body.rulesToColumnResponse
        : JSON.stringify(body.rulesToColumnResponse);

    const agentRequest: Parameters<typeof callLyzrAgent>[0] = {
      user_id: "harshit@lyzr.ai",
      agent_id: AGENT_ID,
      session_id: body.customerId,
      message,
    };

    if (body.fidessa_catalog) {
      agentRequest.system_prompt_variables = {
        fidessa_catalog: JSON.stringify(body.fidessa_catalog),
      };
    }

    const response = await callLyzrAgent<GapAnalysisResponse>(agentRequest);

    let parsedResponse: GapAnalysisResponse;
    if (
      "response" in response &&
      typeof (response as { response?: string }).response === "string"
    ) {
      const parseResult = tryParseJson<GapAnalysisResponse>(
        (response as { response: string }).response
      );
      if (!parseResult.success) {
        throw new Error(
          `Failed to parse agent response: ${parseResult.parseError}`
        );
      }
      parsedResponse = parseResult.data;
    } else {
      parsedResponse = response as GapAnalysisResponse;
    }

    const maxRetries = 5;
    let retryCount = 0;
    let saveSuccess = false;

    while (!saveSuccess && retryCount < maxRetries) {
      try {
        await connectDB();
        const project = await Project.findOne({ customerId: body.customerId });

        if (project?.rulesets?.length) {
          let targetRuleset;
          if (body.rulesetVersion !== undefined) {
            targetRuleset = project.rulesets.find(
              (rs) => rs.version === body.rulesetVersion
            );
          } else {
            targetRuleset = project.rulesets[project.rulesets.length - 1];
          }

          if (targetRuleset) {
            targetRuleset.data.gap_analysis = parsedResponse.mapped_rules;
            project.markModified("rulesets");
            await project.save();
          }
        }
        saveSuccess = true;
      } catch (saveError: unknown) {
        retryCount++;
        const isVersionError =
          (saveError as { name?: string })?.name === "VersionError" ||
          String((saveError as Error)?.message).includes(
            "No matching document found"
          );
        if (isVersionError && retryCount < maxRetries) {
          await new Promise((r) =>
            setTimeout(r, 100 * Math.pow(2, retryCount - 1))
          );
          continue;
        }
        saveSuccess = true;
      }
    }

    await GapAnalysisJob.findOneAndUpdate(
      { jobId },
      {
        status: "completed",
        result: parsedResponse,
        updatedAt: new Date(),
      }
    );
  } catch (error) {
    console.error(`[gap-analysis] Job ${jobId} failed:`, error);
    try {
      await GapAnalysisJob.findOneAndUpdate(
        { jobId },
        {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        }
      );
    } catch (updateErr) {
      console.error(`[gap-analysis] Failed to update job ${jobId}:`, updateErr);
    }
  }
}

/**
 * POST /api/agents/gap-analysis
 * Creates a gap analysis job and returns jobId. Poll GET with jobId for result.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const body = (await req.json()) as GapAnalysisRequest;

    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    if (!body.rulesToColumnResponse) {
      return NextResponse.json(
        { error: "rulesToColumnResponse is required" },
        { status: 400 }
      );
    }
    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const jobId = `${body.customerId}-gap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const job = new GapAnalysisJob({
      jobId,
      projectId: body.projectId,
      customerId: body.customerId,
      status: "pending",
      payload: {
        rulesToColumnResponse: body.rulesToColumnResponse,
        fidessa_catalog: body.fidessa_catalog,
        rulesetVersion: body.rulesetVersion,
      },
    });
    await job.save();

    processGapAnalysisJob(jobId, body).catch((err) => {
      console.error(`[gap-analysis] Unhandled error for job ${jobId}:`, err);
    });

    return NextResponse.json({
      jobId,
      status: "pending",
      message: `Gap analysis started. Poll GET /api/agents/gap-analysis?jobId=${jobId} for status.`,
    });
  } catch (error) {
    console.error("[gap-analysis] POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/gap-analysis?jobId=<jobId>
 * Returns job status and result when completed.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId query parameter is required" },
        { status: 400 }
      );
    }

    const job = await GapAnalysisJob.findOne({ jobId });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const response: {
      jobId: string;
      status: string;
      result?: GapAnalysisResponse;
      error?: string;
      createdAt: string;
      updatedAt: string;
    } = {
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };

    if (job.status === "completed" && job.result) {
      response.result = job.result as GapAnalysisResponse;
    }
    if (job.status === "failed" && job.error) {
      response.error = job.error;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[gap-analysis] GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
