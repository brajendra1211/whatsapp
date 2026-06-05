const mongoose = require("mongoose");

const flowExecutionSchema = new mongoose.Schema(
  {
    flowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MessageFlow",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["running", "waiting", "awaiting_reply", "completed", "handoff", "failed"],
      default: "running",
      index: true,
    },
    currentStepIndex: {
      type: Number,
      default: 0,
    },
    triggerMessage: {
      type: String,
      default: "",
    },
    replyMessage: {
      type: String,
      default: "",
    },
    awaitingStepIndex: {
      type: Number,
      default: null,
    },
    nextRunAt: {
      type: Date,
      default: null,
      index: true,
    },
    errorReason: {
      type: String,
      default: "",
    },
    history: {
      type: [
        {
          stepIndex: Number,
          type: String,
          note: String,
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FlowExecution", flowExecutionSchema);
