import mongoose, { Schema, Document, Model } from "mongoose";

export interface IComparisonJob extends Document {
  jobId: string;
  projectId: string;
  customerId: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComparisonJobSchema = new Schema<IComparisonJob>(
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
    error: {
      type: String,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// TTL index to auto-delete jobs older than 1 hour
ComparisonJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

// Prevent model re-compilation during hot reloads
const ComparisonJob: Model<IComparisonJob> =
  mongoose.models.ComparisonJob ||
  mongoose.model<IComparisonJob>("ComparisonJob", ComparisonJobSchema);

export default ComparisonJob;
