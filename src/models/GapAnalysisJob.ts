import mongoose, { Schema, Document, Model } from "mongoose";

export interface IGapAnalysisJob extends Document {
  jobId: string;
  projectId: string;
  customerId: string;
  status: "pending" | "processing" | "completed" | "failed";
  payload?: {
    rulesToColumnResponse: string | object;
    fidessa_catalog?: Record<string, string>;
    rulesetVersion?: number;
  };
  result?: { mapped_rules: unknown[] };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GapAnalysisJobSchema = new Schema<IGapAnalysisJob>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
    },
    result: {
      type: Schema.Types.Mixed,
    },
    payload: {
      type: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

GapAnalysisJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

const GapAnalysisJob: Model<IGapAnalysisJob> =
  mongoose.models.GapAnalysisJob ||
  mongoose.model<IGapAnalysisJob>("GapAnalysisJob", GapAnalysisJobSchema);

export default GapAnalysisJob;
