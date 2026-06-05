const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    direction: {
      type: String,
      enum: ["outbound", "inbound"],
      default: "outbound",
    },
    type: {
      type: String,
      enum: ["text", "interactive", "image", "document"],
      default: "text",
    },
    message: {
      type: String,
      default: "",
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    waMessageId: {
      type: String,
      default: "",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "replied", "failed"],
      default: "pending",
    },
    errorReason: {
      type: String,
      default: "",
    },
    needsAgent: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
