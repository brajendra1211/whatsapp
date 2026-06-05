const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    campaign_name: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    template_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null,
    },
    audience_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Audience",
      default: null,
    },
    audience_name: {
      type: String,
      default: "All Contacts",
    },
    buttons: [
      {
        type: {
          type: String,
          enum: ["quick_reply", "url", "call"],
          default: "quick_reply",
        },
        text: String,
        value: String,
      },
    ],
    mediaUrl: {
      type: String,
      default: "",
    },
    mediaType: {
      type: String,
      default: "",
    },
    send_mode: {
      type: String,
      enum: ["now", "schedule"],
      default: "now",
    },
    schedule_at: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "processing", "completed", "failed"],
      default: "processing",
    },
    total: {
      type: Number,
      default: 0,
    },
    sent: {
      type: Number,
      default: 0,
    },
    delivered: {
      type: Number,
      default: 0,
    },
    read: {
      type: Number,
      default: 0,
    },
    replied: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);