const mongoose = require("mongoose");

const flowStepSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "send_message",
        "send_template",
        "wait",
        "await_reply",
        "note",
        "handoff",
        "tag_contact",
        "add_to_audience",
        "condition",
      ],
      required: true,
    },
    message: {
      type: String,
      default: "",
    },
    delayMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    label: {
      type: String,
      default: "",
    },
    tag: {
      type: String,
      default: "",
    },
    conditionKeyword: {
      type: String,
      default: "",
    },
    conditionMatchMode: {
      type: String,
      enum: ["contains", "exact"],
      default: "contains",
    },
    jumpToStep: {
      type: Number,
      default: 0,
      min: 0,
    },
    noReplyDelayMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    noReplyJumpToStep: {
      type: Number,
      default: 0,
      min: 0,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null,
    },
    audienceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Audience",
      default: null,
    },
  },
  { _id: false }
);

const messageFlowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "paused"],
      default: "active",
      index: true,
    },
    triggerKeyword: {
      type: String,
      required: true,
      trim: true,
    },
    matchMode: {
      type: String,
      enum: ["contains", "exact"],
      default: "contains",
    },
    triggerSource: {
      type: String,
      enum: ["all", "campaign_reply"],
      default: "all",
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },
    steps: {
      type: [flowStepSchema],
      default: [],
    },
    runs: {
      type: Number,
      default: 0,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MessageFlow", messageFlowSchema);
