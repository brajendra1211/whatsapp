const mongoose = require("mongoose");

const whatsappConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    wabaId: {
      type: String,
      required: true,
    },
    phoneNumberId: {
      type: String,
      required: true,
    },
    businessId: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["connected", "disconnected"],
      default: "connected",
    },
    raw: {
      type: Object,
      default: {},
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WhatsAppConnection", whatsappConnectionSchema);
