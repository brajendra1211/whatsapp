const Contact = require("../models/Contact");
const Audience = require("../models/Audience");
const Campaign = require("../models/Campaign");
const Message = require("../models/Message");
const Template = require("../models/Template");
const WhatsAppConnection = require("../models/WhatsAppConnection");
const {
  sendTextMessage,
  sendInteractiveButtonsMessage,
  sendMediaMessage,
} = require("../services/whatsappService");

const getWhatsAppCredentials = async (userId) => {
  const connection = await WhatsAppConnection.findOne({
    userId,
    status: "connected",
  });

  if (!connection) return {};

  return {
    accessToken: connection.accessToken,
    phoneNumberId: connection.phoneNumberId,
    wabaId: connection.wabaId,
  };
};

const normalizePhone = (phone = "") => {
  let clean = String(phone).replace(/[^\d]/g, "");

  if (clean.startsWith("0")) {
    clean = clean.slice(1);
  }

  // India local 10-digit -> add 91
  if (clean.length === 10) {
    clean = `91${clean}`;
  }

  return clean;
};

const personalizeMessage = (text = "", contact = {}) => {
  return text
    .replace(/\{name\}/gi, contact.name || "")
    .replace(/\{phone\}/gi, normalizePhone(contact.phone || ""));
};

const getAudienceContacts = async (userId, audienceId) => {
  if (!audienceId || audienceId === "all") {
    return await Contact.find({ userId });
  }

  const audience = await Audience.findOne({
    _id: audienceId,
    userId,
  }).populate("contacts");

  if (!audience) return [];

  return audience.contacts || [];
};

const dedupeContactsByPhone = (contacts = []) => {
  const map = new Map();

  for (const contact of contacts) {
    const normalizedPhone = normalizePhone(contact.phone);

    if (!normalizedPhone) continue;

    if (!map.has(normalizedPhone)) {
      map.set(normalizedPhone, {
        ...contact.toObject?.() ? contact.toObject() : contact,
        phone: normalizedPhone,
      });
    }
  }

  return Array.from(map.values());
};

const buildPlainTextWithExtraButtons = (body, buttons = []) => {
  const extraLines = buttons
    .filter((b) => b.type === "url" || b.type === "call")
    .map((b) => `${b.text}: ${b.value}`);

  if (!extraLines.length) return body;
  return `${body}\n\n${extraLines.join("\n")}`;
};

const sendToSingleContact = async ({
  contact,
  message,
  buttons,
  mediaPath,
  mediaType,
  credentials,
}) => {
  const normalizedPhone = normalizePhone(contact.phone);
  const normalizedContact = {
    ...contact,
    phone: normalizedPhone,
  };

  const personalized = personalizeMessage(message, normalizedContact);

  if (mediaPath) {
    return {
      apiResponse: await sendMediaMessage({
        to: normalizedPhone,
        filePath: mediaPath,
        mimeType: mediaType,
        caption: personalized,
        credentials,
      }),
      type: mediaType.startsWith("image/") ? "image" : "document",
      finalMessage: personalized,
      normalizedPhone,
    };
  }

  const onlyQuickReply =
    Array.isArray(buttons) &&
    buttons.length > 0 &&
    buttons.every((b) => b.type === "quick_reply");

  if (onlyQuickReply) {
    return {
      apiResponse: await sendInteractiveButtonsMessage({
        to: normalizedPhone,
        body: personalized,
        credentials,
        buttons: buttons.map((b, index) => ({
          id: b.value || `reply_${index + 1}`,
          title: b.text || `Reply ${index + 1}`,
        })),
      }),
      type: "interactive",
      finalMessage: personalized,
      normalizedPhone,
    };
  }

  const finalMessage = buildPlainTextWithExtraButtons(personalized, buttons);

  return {
    apiResponse: await sendTextMessage({
      to: normalizedPhone,
      body: finalMessage,
      credentials,
    }),
    type: "text",
    finalMessage,
    normalizedPhone,
  };
};

const executeCampaign = async (campaign) => {
  const credentials = await getWhatsAppCredentials(campaign.userId);
  const contacts = await getAudienceContacts(campaign.userId, campaign.audience_id);
  const uniqueContacts = dedupeContactsByPhone(contacts).filter(
    (contact) => !contact.optOut
  );

  campaign.total = uniqueContacts.length;
  campaign.status = "processing";
  await campaign.save();

  let sent = 0;
  let failed = 0;

  for (const contact of uniqueContacts) {
    const normalizedPhone = normalizePhone(contact.phone);
    const personalized = personalizeMessage(campaign.message, {
      ...contact,
      phone: normalizedPhone,
    });

    const log = await Message.create({
      campaignId: campaign._id,
      contactId: contact._id || null,
      userId: campaign.userId,
      phone: normalizedPhone,
      name: contact.name || "",
      direction: "outbound",
      type: "text",
      message: personalized,
      mediaUrl: campaign.mediaUrl || "",
      status: "pending",
    });

    try {
      const result = await sendToSingleContact({
        contact: {
          ...contact,
          phone: normalizedPhone,
        },
        message: campaign.message,
        buttons: campaign.buttons || [],
        mediaPath: campaign.mediaUrl || "",
        mediaType: campaign.mediaType || "",
        credentials,
      });

      log.type = result.type;
      log.phone = result.normalizedPhone;
      log.message = result.finalMessage;
      log.status = "sent";
      log.waMessageId = result.apiResponse?.messages?.[0]?.id || "";
      await log.save();

      sent++;
    } catch (error) {
      log.phone = normalizedPhone;
      log.status = "failed";
      log.errorReason =
        error?.response?.data?.error?.message ||
        error.message ||
        "Send failed";
      await log.save();

      failed++;
    }
  }

  campaign.sent = sent;
  campaign.failed = failed;
  campaign.status =
    failed === uniqueContacts.length && uniqueContacts.length > 0
      ? "failed"
      : "completed";

  await campaign.save();

  return campaign;
};

exports.processScheduledCampaigns = async () => {
  try {
    const dueCampaigns = await Campaign.find({
      send_mode: "schedule",
      status: "scheduled",
      schedule_at: { $lte: new Date() },
    });

    for (const campaign of dueCampaigns) {
      await executeCampaign(campaign);
    }
  } catch (error) {
    console.error("Scheduled campaign error:", error.message);
  }
};

exports.sendTestMessage = async (req, res) => {
  try {
    const { message, test_number, buttons = "[]" } = req.body;

    if (!test_number || !message) {
      return res
        .status(400)
        .json({ message: "Test number and message are required" });
    }

    const normalizedTestNumber = normalizePhone(test_number);

    const tempContact = {
      name: "Test User",
      phone: normalizedTestNumber,
    };

    const parsedButtons =
      typeof buttons === "string" ? JSON.parse(buttons || "[]") : buttons;
    const credentials = await getWhatsAppCredentials(req.user._id);

    const result = await sendToSingleContact({
      contact: tempContact,
      message,
      buttons: parsedButtons,
      mediaPath: req.file?.path || "",
      mediaType: req.file?.mimetype || "",
      credentials,
    });

    return res.json({
      message: "Test message sent successfully",
      waMessageId: result.apiResponse?.messages?.[0]?.id || "",
      phone: result.normalizedPhone,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        error?.response?.data?.error?.message ||
        "Failed to send test message",
    });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const {
      campaign_name,
      message,
      template_id = null,
      audience_id = "all",
      send_mode = "now",
      schedule_at = null,
      buttons = "[]",
    } = req.body;

    if (!campaign_name) {
      return res.status(400).json({ message: "Campaign name is required" });
    }

    const parsedButtons =
      typeof buttons === "string" ? JSON.parse(buttons || "[]") : buttons;

    let selectedTemplate = null;

    if (template_id) {
      selectedTemplate = await Template.findOne({
        _id: template_id,
        userId: req.user._id,
      });

      if (!selectedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (selectedTemplate.metaStatus !== "APPROVED") {
        return res.status(400).json({
          message: `Only approved Meta templates can be sent. Current status: ${selectedTemplate.metaStatus}`,
        });
      }
    }

    const finalMessage = selectedTemplate ? selectedTemplate.content : message;
    const finalButtons = selectedTemplate ? selectedTemplate.buttons : parsedButtons;

    if (!finalMessage) {
      return res.status(400).json({ message: "Message is required" });
    }

    let audienceName = "All Contacts";

    if (audience_id && audience_id !== "all") {
      const audience = await Audience.findOne({
        _id: audience_id,
        userId: req.user._id,
      });

      if (audience) {
        audienceName = audience.name;
      }
    }

    const campaign = await Campaign.create({
      campaign_name,
      message: finalMessage,
      template_id: selectedTemplate ? selectedTemplate._id : null,
      audience_id: audience_id !== "all" ? audience_id : null,
      audience_name: audienceName,
      buttons: finalButtons,
      mediaUrl: req.file?.path || "",
      mediaType: req.file?.mimetype || "",
      send_mode,
      schedule_at:
        send_mode === "schedule" && schedule_at
          ? new Date(schedule_at)
          : null,
      status: send_mode === "schedule" ? "scheduled" : "processing",
      userId: req.user._id,
    });

    if (send_mode === "schedule") {
      return res.json({
        message: "Campaign scheduled successfully",
        campaign,
      });
    }

    const executedCampaign = await executeCampaign(campaign);

    return res.json({
      message: "Campaign sent successfully",
      total: executedCampaign.total,
      sent: executedCampaign.sent,
      failed: executedCampaign.failed,
      campaign: executedCampaign,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        error?.response?.data?.error?.message || "Campaign action failed",
    });
  }
};
exports.getCampaignHistory = async (req, res) => {
  try {
    const campaigns = await Campaign.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json({ campaigns });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch campaign history" });
  }
};

exports.getDeliveryStatus = async (req, res) => {
  try {
    const sent = await Message.countDocuments({
      userId: req.user._id,
      status: { $in: ["sent", "delivered", "read", "replied"] },
    });

    const delivered = await Message.countDocuments({
      userId: req.user._id,
      status: { $in: ["delivered", "read", "replied"] },
    });

    const read = await Message.countDocuments({
      userId: req.user._id,
      status: { $in: ["read", "replied"] },
    });

    const replied = await Message.countDocuments({
      userId: req.user._id,
      status: "replied",
    });

    const failed = await Message.countDocuments({
      userId: req.user._id,
      status: "failed",
    });

    return res.json({
      summary: {
        sent,
        delivered,
        read,
        replied,
        failed,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch delivery status" });
  }
};

exports.getFailedReport = async (req, res) => {
  try {
    const failed = await Message.find({
      userId: req.user._id,
      status: "failed",
    })
      .populate("campaignId", "campaign_name")
      .sort({ createdAt: -1 });

    const finalData = failed.map((item) => ({
      _id: item._id,
      phone: item.phone,
      reason: item.errorReason || "Unknown error",
      campaign_name: item.campaignId?.campaign_name || "",
      createdAt: item.createdAt,
    }));

    return res.json({ failed: finalData });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch failed report" });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const campaigns = await Campaign.find({
      userId: req.user._id,
    }).sort({ createdAt: 1 });

    const grouped = {};

    for (const item of campaigns) {
      const d = new Date(item.createdAt);
      const key = d.toLocaleDateString();

      if (!grouped[key]) {
        grouped[key] = 0;
      }

      grouped[key] += item.sent || item.total || 0;
    }

    const analytics = Object.keys(grouped).map((key) => ({
      label: key,
      total: grouped[key],
    }));

    return res.json({ analytics });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch analytics" });
  }
};
