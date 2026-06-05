const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    leadStage: {
      type: String,
      enum: ["new", "interested", "site_visit", "negotiation", "closed", "lost"],
      default: "new",
      index: true,
    },
    leadSource: {
      type: String,
      default: "",
      trim: true,
    },
    budget: {
      type: String,
      default: "",
      trim: true,
    },
    dealValue: {
      type: String,
      default: "",
      trim: true,
    },
    propertyType: {
      type: String,
      default: "",
      trim: true,
    },
    requirementType: {
      type: String,
      default: "",
      trim: true,
    },
    preferredLocation: {
      type: String,
      default: "",
      trim: true,
    },
    preference: {
      type: String,
      default: "",
      trim: true,
    },
    reminderAt: {
      type: Date,
      default: null,
      index: true,
    },
    reminderNote: {
      type: String,
      default: "",
      trim: true,
    },
    lastFollowUpAt: {
      type: Date,
      default: null,
    },
    profileNote: {
      type: String,
      default: "",
      trim: true,
    },
    optOut: {
      type: Boolean,
      default: false,
    },
    optOutAt: {
      type: Date,
      default: null,
    },
    optOutReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

contactSchema.index({ userId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("Contact", contactSchema);
