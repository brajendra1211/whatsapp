const Template = require("../models/Template");
const WhatsAppConnection = require("../models/WhatsAppConnection");
const {
  createMetaTemplate,
  fetchMetaTemplates,
} = require("../services/metaTemplateService");

const getWhatsAppCredentials = async (userId) => {
  const connection = await WhatsAppConnection.findOne({
    userId,
    status: "connected",
  });

  if (!connection) return null;

  return {
    accessToken: connection.accessToken,
    phoneNumberId: connection.phoneNumberId,
    wabaId: connection.wabaId,
  };
};

const getMetaErrorMessage = (error) => {
  const metaError = error?.response?.data?.error;
  if (!metaError) return error.message || "Meta template submission failed";

  const details = [
    metaError.message,
    metaError.error_user_title,
    metaError.error_user_msg,
    metaError.error_data?.details,
  ].filter(Boolean);

  return details.join(" - ") || "Meta template submission failed";
};

const getMetaErrorDetails = (error) => {
  const metaError = error?.response?.data?.error;
  if (!metaError) return null;

  return {
    type: metaError.type || "",
    code: metaError.code || "",
    subcode: metaError.error_subcode || "",
    fbtrace_id: metaError.fbtrace_id || "",
    details: metaError.error_data?.details || "",
  };
};

exports.listTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json({ templates });
  } catch (error) {
    console.error("listTemplates error:", error);
    return res.status(500).json({ message: "Failed to fetch templates" });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const {
      name,
      content,
      category = "MARKETING",
      language = "en_US",
      buttons = [],
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({ message: "Name and content are required" });
    }

    const template = await Template.create({
      name,
      content,
      category,
      language,
      buttons,
      metaStatus: "PENDING_SUBMISSION",
      userId: req.user._id,
    });

    try {
      const credentials = await getWhatsAppCredentials(req.user._id);
      if (!credentials) {
        template.metaStatus = "SUBMISSION_FAILED";
        await template.save();

        return res.status(400).json({
          message: "WhatsApp account is not connected for this user. Please connect it from WhatsApp Setup.",
          template,
        });
      }

      const metaRes = await createMetaTemplate({
        name,
        content,
        category,
        language,
        buttons,
        credentials,
      });

      template.metaTemplateId = metaRes.id || "";
      template.metaTemplateName = metaRes.name || name;
      template.metaStatus = metaRes.status || "PENDING";
      template.submittedToMeta = true;
      template.lastSyncedAt = new Date();
      await template.save();

      return res.status(201).json({
        message: "Template submitted to Meta successfully",
        template,
      });
    } catch (metaError) {
      template.metaStatus = "SUBMISSION_FAILED";
      await template.save();

      console.error("Meta template submission error:", getMetaErrorDetails(metaError));

      return res.status(400).json({
        message: getMetaErrorMessage(metaError),
        metaError: getMetaErrorDetails(metaError),
        template,
      });
    }
  } catch (error) {
    console.error("createTemplate error:", error);
    return res.status(500).json({ message: "Failed to create template" });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { name, content, category, language = "en_US", buttons = [] } =
      req.body;

    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        name,
        content,
        category,
        language,
        buttons,
      },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    return res.json({
      message: "Template updated locally",
      template,
    });
  } catch (error) {
    console.error("updateTemplate error:", error);
    return res.status(500).json({ message: "Failed to update template" });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    return res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("deleteTemplate error:", error);
    return res.status(500).json({ message: "Failed to delete template" });
  }
};

exports.syncMetaTemplateStatuses = async (req, res) => {
  try {
    const credentials = await getWhatsAppCredentials(req.user._id);
    if (!credentials) {
      return res.status(400).json({
        message: "WhatsApp account is not connected for this user. Please connect it from WhatsApp Setup.",
      });
    }

    const metaData = await fetchMetaTemplates(credentials);
    const metaTemplates = Array.isArray(metaData?.data) ? metaData.data : [];

    const localTemplates = await Template.find({ userId: req.user._id });

    for (const local of localTemplates) {
      const found = metaTemplates.find(
        (m) =>
          String(m.id || "") === String(local.metaTemplateId || "") ||
          String(m.name || "") ===
            String(local.metaTemplateName || local.name || "")
      );

      if (found) {
        local.metaTemplateId = found.id || local.metaTemplateId;
        local.metaTemplateName = found.name || local.metaTemplateName;
        local.metaStatus = found.status || local.metaStatus;
        local.category = found.category || local.category;
        local.metaQuality =
          found.quality_score?.score ||
          found.quality_rating ||
          local.metaQuality;
        local.submittedToMeta = true;
        local.lastSyncedAt = new Date();
        await local.save();
      }
    }

    const templates = await Template.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json({
      message: "Template statuses synced from Meta",
      templates,
    });
  } catch (error) {
    console.error("syncMetaTemplateStatuses error:", error);
    return res.status(500).json({
      message:
        error?.response?.data?.error?.message ||
        "Failed to sync template statuses",
    });
  }
};
