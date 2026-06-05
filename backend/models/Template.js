const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["MARKETING", "UTILITY", "AUTHENTICATION"],
      default: "MARKETING",
    },
    language: {
      type: String,
      default: "en_US",
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

    metaTemplateId: {
      type: String,
      default: "",
    },
    metaTemplateName: {
      type: String,
      default: "",
    },
    metaStatus: {
      type: String,
      default: "DRAFT",
    },
    metaQuality: {
      type: String,
      default: "",
    },
    submittedToMeta: {
      type: Boolean,
      default: false,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Template", templateSchema);