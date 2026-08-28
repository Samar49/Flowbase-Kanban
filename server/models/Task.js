import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const sessionSchema = new mongoose.Schema(
  {
    startedAt: Date,
    endedAt: Date,
    duration: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    serial: Number,

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: String,

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    column: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    position: {
      type: Number,
      default: 0,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    labels: [String],

    dueDate: Date,

    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: Date,

    estimatedTime: {
      type: Number,
      default: 0,
    },

    actualTime: {
      type: Number,
      default: 0,
    },

    subtasks: [subtaskSchema],

    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],

    timerStartedAt: Date,

    sessions: [sessionSchema],

    // Soft-delete / Trash support.
    // MongoDB's TTL index permanently removes a trashed task
    // roughly 24 hours after this field is set.
    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({
  project: 1,
  column: 1,
  position: 1,
});

// Permanently remove tasks 24 hours after they enter Trash.
// The partial index means active tasks (deletedAt: null/missing)
// are not affected by the TTL rule.
taskSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24,
    partialFilterExpression: {
      deletedAt: {
        $type: "date",
      },
    },
  }
);

export default mongoose.model("Task", taskSchema);
