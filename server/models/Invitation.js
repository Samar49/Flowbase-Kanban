import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    respondedAt: Date,
  },
  { timestamps: true }
);

invitationSchema.index(
  { project: 1, invitee: 1, status: 1 },
  { name: "project_invitee_status" }
);

invitationSchema.index(
  { invitee: 1, status: 1, createdAt: -1 },
  { name: "invitee_status_created" }
);

export default mongoose.model("Invitation", invitationSchema);
