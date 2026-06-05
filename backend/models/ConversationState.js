const mongoose = require("mongoose");

const conversationStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "closed", "pending"],
      default: "open",
    },
    labels: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
      default: "",
    },
    assignedTo: {
      type: String,
      default: "",
    },
    lastAgentActionAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

conversationStateSchema.index({ userId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("ConversationState", conversationStateSchema);
