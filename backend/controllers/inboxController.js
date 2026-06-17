const Message = require("../models/Message");
const Contact = require("../models/Contact");
const Audience = require("../models/Audience");
const ConversationState = require("../models/ConversationState");
const FlowExecution = require("../models/FlowExecution");
const WhatsAppConnection = require("../models/WhatsAppConnection");
const { sendTextMessage } = require("../services/whatsappService");

const normalizePhone = (phone = "") => {
  let clean = String(phone).replace(/[^\d]/g, "");

  if (clean.startsWith("0")) {
    clean = clean.slice(1);
  }

  if (clean.length === 10) {
    clean = `91${clean}`;
  }

  return clean;
};

const LEAD_STAGES = ["new", "interested", "site_visit", "negotiation", "closed", "lost"];

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

const buildContactProfilePayload = (body = {}) => {
  const payload = {};

  if (body.name !== undefined) payload.name = String(body.name || "").trim();
  if (body.leadStage !== undefined) {
    payload.leadStage = LEAD_STAGES.includes(body.leadStage) ? body.leadStage : "new";
  }

  for (const key of [
    "leadSource",
    "budget",
    "dealValue",
    "propertyType",
    "requirementType",
    "preferredLocation",
    "preference",
    "reminderNote",
    "profileNote",
  ]) {
    if (body[key] !== undefined) payload[key] = String(body[key] || "").trim();
  }

  if (body.dealValue !== undefined && body.budget === undefined) {
    payload.budget = String(body.dealValue || "").trim();
  }
  if (body.requirementType !== undefined && body.propertyType === undefined) {
    payload.propertyType = String(body.requirementType || "").trim();
  }
  if (body.preference !== undefined && body.preferredLocation === undefined) {
    payload.preferredLocation = String(body.preference || "").trim();
  }

  if (body.reminderAt !== undefined) {
    const reminderDate = body.reminderAt ? new Date(body.reminderAt) : null;
    payload.reminderAt =
      reminderDate && !Number.isNaN(reminderDate.getTime()) ? reminderDate : null;
  }

  if (body.lastFollowUpAt !== undefined) {
    const followUpDate = body.lastFollowUpAt ? new Date(body.lastFollowUpAt) : null;
    payload.lastFollowUpAt =
      followUpDate && !Number.isNaN(followUpDate.getTime()) ? followUpDate : null;
  }

  return payload;
};

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $match: {
          userId: req.user._id,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$phone",
          phone: { $first: "$phone" },
          lastMessage: { $first: "$message" },
          lastMessageAt: { $first: "$createdAt" },
          lastDirection: { $first: "$direction" },
          lastStatus: { $first: "$status" },
          name: { $first: "$name" },
          needsAgent: { $max: "$needsAgent" },
        },
      },
      {
        $sort: { lastMessageAt: -1 },
      },
    ]);

    const phones = conversations.map((item) => item.phone).filter(Boolean);
    const [states, contacts] = await Promise.all([
      ConversationState.find({ userId: req.user._id, phone: { $in: phones } }),
      Contact.find({ userId: req.user._id, phone: { $in: phones } }),
    ]);
    const stateByPhone = new Map(states.map((state) => [state.phone, state]));
    const contactByPhone = new Map(contacts.map((contact) => [contact.phone, contact]));

    const enriched = conversations.map((item) => {
      const state = stateByPhone.get(item.phone);
      const contact = contactByPhone.get(item.phone);

      return {
        ...item,
        conversationStatus: state?.status || "open",
        labels: state?.labels || [],
        note: state?.note || "",
        assignedTo: state?.assignedTo || "",
        contactId: contact?._id || null,
        contactTags: contact?.tags || [],
        leadStage: contact?.leadStage || "new",
        reminderAt: contact?.reminderAt || null,
        reminderNote: contact?.reminderNote || "",
        dealValue: contact?.dealValue || contact?.budget || "",
        requirementType: contact?.requirementType || contact?.propertyType || "",
        preference: contact?.preference || contact?.preferredLocation || "",
        optOut: Boolean(contact?.optOut),
        optOutAt: contact?.optOutAt || null,
      };
    });

    return res.json({ conversations: enriched });
  } catch (error) {
    console.error("getConversations error:", error);
    return res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

exports.getMessagesByPhone = async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);

    const [messages, state, contact] = await Promise.all([
      Message.find({
        userId: req.user._id,
        phone,
      }).sort({ createdAt: 1 }),
      ConversationState.findOne({ userId: req.user._id, phone }),
      Contact.findOne({ userId: req.user._id, phone }),
    ]);

    return res.json({
      messages,
      state: state || null,
      contact: contact || null,
    });
  } catch (error) {
    console.error("getMessagesByPhone error:", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
};

exports.sendReply = async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ message: "Phone and message are required" });
    }

    const normalizedPhone = normalizePhone(phone);
    const contact = await Contact.findOne({
      userId: req.user._id,
      phone: normalizedPhone,
    });

    if (contact?.optOut) {
      return res.status(400).json({
        message: "This contact has opted out. Reply sending is blocked.",
      });
    }

    const credentials = await getWhatsAppCredentials(req.user._id);
    if (!credentials) {
      return res.status(400).json({
        message: "WhatsApp account is not connected for this user. Please connect it from WhatsApp Setup.",
      });
    }

    const apiResponse = await sendTextMessage({
      to: normalizedPhone,
      body: message,
      credentials,
    });

    const newMessage = await Message.create({
      userId: req.user._id,
      phone: normalizedPhone,
      name: contact?.name || "",
      direction: "outbound",
      type: "text",
      message,
      waMessageId: apiResponse?.messages?.[0]?.id || "",
      status: "sent",
    });

    return res.json({
      message: "Reply sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("sendReply error:", error?.response?.data || error.message);
    return res.status(500).json({
      message: error?.response?.data?.error?.message || "Failed to send reply",
    });
  }
};

exports.updateContactProfileByPhone = async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
    const payload = buildContactProfilePayload(req.body);

    if (!payload.name) {
      delete payload.name;
    }

    const insertDefaults = {
      userId: req.user._id,
      phone,
    };

    if (!payload.name) {
      insertDefaults.name = req.body.name || phone;
    }

    const contact = await Contact.findOneAndUpdate(
      { userId: req.user._id, phone },
      {
        $set: payload,
        $setOnInsert: insertDefaults,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ message: "Customer profile updated", contact });
  } catch (error) {
    console.error("updateContactProfileByPhone error:", error);
    return res.status(500).json({ message: "Failed to update customer profile" });
  }
};

exports.updateConversationState = async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
    const labels = Array.isArray(req.body.labels)
      ? req.body.labels
      : String(req.body.labels || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    const state = await ConversationState.findOneAndUpdate(
      {
        userId: req.user._id,
        phone,
      },
      {
        $set: {
          status: req.body.status || "open",
          labels: [...new Set(labels)],
          note: req.body.note || "",
          assignedTo: req.body.assignedTo || "",
          lastAgentActionAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({ message: "Conversation updated", state });
  } catch (error) {
    console.error("updateConversationState error:", error);
    return res.status(500).json({ message: "Failed to update conversation" });
  }
};

exports.getContactTimeline = async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
    const contact = await Contact.findOne({ userId: req.user._id, phone });

    const [messages, executions, audiences] = await Promise.all([
      Message.find({ userId: req.user._id, phone }).sort({ createdAt: 1 }),
      FlowExecution.find({ userId: req.user._id, phone })
        .populate("flowId", "name")
        .sort({ createdAt: 1 }),
      contact
        ? Audience.find({ userId: req.user._id, contacts: contact._id }).sort({
            createdAt: 1,
          })
        : Promise.resolve([]),
    ]);

    const events = [];

    if (contact) {
      events.push({
        type: "contact",
        title: "Contact created",
        detail: contact.name || contact.phone,
        createdAt: contact.createdAt,
      });

      if (contact.optOut) {
        events.push({
          type: "opt_out",
          title: "Opted out",
          detail: contact.optOutReason || "Customer requested no further messages",
          createdAt: contact.optOutAt || contact.updatedAt,
        });
      }
    }

    for (const audience of audiences) {
      events.push({
        type: "audience",
        title: "Added to audience",
        detail: audience.name,
        createdAt: audience.updatedAt || audience.createdAt,
      });
    }

    for (const execution of executions) {
      events.push({
        type: "flow",
        title: `Flow ${execution.status}`,
        detail: execution.flowId?.name || "Automation flow",
        createdAt: execution.createdAt,
      });
    }

    for (const message of messages) {
      events.push({
        type: "message",
        title: message.direction === "inbound" ? "Customer message" : "Business message",
        detail: message.message || message.type || "",
        createdAt: message.createdAt,
      });
    }

    events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ contact: contact || null, events });
  } catch (error) {
    console.error("getContactTimeline error:", error);
    return res.status(500).json({ message: "Failed to fetch timeline" });
  }
};
