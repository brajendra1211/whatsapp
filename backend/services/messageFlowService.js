const Contact = require("../models/Contact");
const Audience = require("../models/Audience");
const FlowExecution = require("../models/FlowExecution");
const Message = require("../models/Message");
const MessageFlow = require("../models/MessageFlow");
const Template = require("../models/Template");
const WhatsAppConnection = require("../models/WhatsAppConnection");
const { sendTemplateMessage, sendTextMessage } = require("./whatsappService");

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

const personalizeMessage = (text = "", contact = {}) => {
  return text
    .replace(/\{name\}/gi, contact.name || "")
    .replace(/\{phone\}/gi, normalizePhone(contact.phone || ""));
};

const matchesTrigger = (flow, text = "") => {
  const keyword = String(flow.triggerKeyword || "").trim().toLowerCase();
  const body = String(text || "").trim().toLowerCase();

  if (!keyword || !body) return false;
  if (flow.matchMode === "exact") return body === keyword;

  return body.includes(keyword);
};

const matchesSource = (flow, { source = "inbound", campaignId = null } = {}) => {
  if (flow.triggerSource === "campaign_reply") {
    if (source !== "campaign_reply") return false;
    if (flow.campaignId && String(flow.campaignId) !== String(campaignId || "")) {
      return false;
    }
  }

  return true;
};

const matchesText = ({ keyword = "", matchMode = "contains", text = "" }) => {
  const needle = String(keyword || "").trim().toLowerCase();
  const body = String(text || "").trim().toLowerCase();

  if (!needle || !body) return false;
  if (matchMode === "exact") return body === needle;

  return body.includes(needle);
};

const getCredentials = async (userId) => {
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

const findOrCreateContact = async ({ userId, phone, name = "" }) => {
  const normalizedPhone = normalizePhone(phone);
  const existing = await Contact.findOne({ userId, phone: normalizedPhone });

  if (existing) return existing;

  return Contact.create({
    userId,
    phone: normalizedPhone,
    name: name || normalizedPhone,
  });
};

const pushHistory = (execution, stepIndex, type, note) => {
  execution.history.push({
    stepIndex,
    type,
    note,
    createdAt: new Date(),
  });
};

const extractTemplateParameters = (content = "", contact = {}) => {
  const matches = String(content).match(/\{\{\d+\}\}/g) || [];
  const unique = [...new Set(matches)].sort((a, b) => {
    const left = Number(a.replace(/\D/g, ""));
    const right = Number(b.replace(/\D/g, ""));
    return left - right;
  });

  return unique.map((_, index) => {
    if (index === 0) return contact.name || "Customer";
    if (index === 1) return normalizePhone(contact.phone || "");
    return "-";
  });
};

const runExecution = async (execution) => {
  const flow = await MessageFlow.findOne({
    _id: execution.flowId,
    userId: execution.userId,
  });

  if (!flow || flow.status !== "active") {
    execution.status = "failed";
    execution.errorReason = "Flow is missing or paused";
    await execution.save();
    return execution;
  }

  const contactRecord = await Contact.findOne({
    userId: execution.userId,
    phone: execution.phone,
  });

  if (contactRecord?.optOut) {
    execution.status = "completed";
    execution.nextRunAt = null;
    pushHistory(execution, execution.currentStepIndex, "opt_out", "Contact opted out");
    await execution.save();
    return execution;
  }

  const credentials = await getCredentials(execution.userId);
  if (!credentials) {
    execution.status = "failed";
    execution.errorReason =
      "WhatsApp account is not connected for this user. Please connect it from WhatsApp Setup.";
    pushHistory(execution, execution.currentStepIndex, "failed", execution.errorReason);
    await execution.save();
    return execution;
  }

  const contact = {
    name: execution.name,
    phone: execution.phone,
  };

  let guard = 0;

  while (execution.currentStepIndex < flow.steps.length && guard < 100) {
    guard += 1;
    const stepIndex = execution.currentStepIndex;
    const step = flow.steps[stepIndex];

    if (step.type === "wait") {
      const delayMinutes = Number(step.delayMinutes || 0);
      execution.status = "waiting";
      execution.nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      execution.currentStepIndex += 1;
      pushHistory(execution, stepIndex, "wait", `Waiting ${delayMinutes} minute(s)`);
      await execution.save();
      return execution;
    }

    if (step.type === "await_reply") {
      execution.status = "awaiting_reply";
      execution.nextRunAt = step.noReplyDelayMinutes
        ? new Date(Date.now() + Number(step.noReplyDelayMinutes || 0) * 60 * 1000)
        : null;
      execution.currentStepIndex += 1;
      execution.awaitingStepIndex = stepIndex;
      pushHistory(execution, stepIndex, "await_reply", step.label || "Waiting for customer reply");
      await execution.save();
      return execution;
    }

    if (step.type === "send_message") {
      const finalMessage = personalizeMessage(step.message, contact);
      const log = await Message.create({
        userId: execution.userId,
        contactId: execution.contactId || null,
        phone: execution.phone,
        name: execution.name,
        direction: "outbound",
        type: "text",
        message: finalMessage,
        status: "pending",
      });

      try {
        const apiResponse = await sendTextMessage({
          to: execution.phone,
          body: finalMessage,
          credentials,
        });

        log.status = "sent";
        log.waMessageId = apiResponse?.messages?.[0]?.id || "";
        await log.save();
        pushHistory(execution, stepIndex, "send_message", finalMessage);
      } catch (error) {
        log.status = "failed";
        log.errorReason =
          error?.response?.data?.error?.message || error.message || "Send failed";
        await log.save();

        execution.status = "failed";
        execution.errorReason = log.errorReason;
        pushHistory(execution, stepIndex, "failed", log.errorReason);
        await execution.save();
        return execution;
      }
    }

    if (step.type === "send_template") {
      const template = step.templateId
        ? await Template.findOne({
            _id: step.templateId,
            userId: execution.userId,
          })
        : null;

      if (!template) {
        execution.status = "failed";
        execution.errorReason = "Template step is missing a valid template";
        pushHistory(execution, stepIndex, "failed", execution.errorReason);
        await execution.save();
        return execution;
      }

      const templateName = template.metaTemplateName || template.name;
      const parameters = extractTemplateParameters(template.content, contact);
      const log = await Message.create({
        userId: execution.userId,
        contactId: execution.contactId || null,
        phone: execution.phone,
        name: execution.name,
        direction: "outbound",
        type: "text",
        message: template.content,
        status: "pending",
      });

      try {
        const apiResponse = await sendTemplateMessage({
          to: execution.phone,
          templateName,
          language: template.language,
          parameters,
          credentials,
        });

        log.status = "sent";
        log.waMessageId = apiResponse?.messages?.[0]?.id || "";
        await log.save();
        pushHistory(execution, stepIndex, "send_template", templateName);
      } catch (error) {
        log.status = "failed";
        log.errorReason =
          error?.response?.data?.error?.message || error.message || "Template send failed";
        await log.save();

        execution.status = "failed";
        execution.errorReason = log.errorReason;
        pushHistory(execution, stepIndex, "failed", log.errorReason);
        await execution.save();
        return execution;
      }
    }

    if (step.type === "note") {
      pushHistory(execution, stepIndex, "note", step.label || "Note added");
    }

    if (step.type === "tag_contact") {
      const tag = String(step.tag || step.label || "").trim();

      if (tag && execution.contactId) {
        await Contact.findOneAndUpdate(
          { _id: execution.contactId, userId: execution.userId },
          { $addToSet: { tags: tag } }
        );
      }

      pushHistory(execution, stepIndex, "tag_contact", tag || "Contact tagged");
    }

    if (step.type === "add_to_audience") {
      if (step.audienceId && execution.contactId) {
        await Audience.findOneAndUpdate(
          { _id: step.audienceId, userId: execution.userId },
          { $addToSet: { contacts: execution.contactId } }
        );
      }

      pushHistory(execution, stepIndex, "add_to_audience", "Contact added to audience");
    }

    if (step.type === "condition") {
      const matched = matchesText({
        keyword: step.conditionKeyword,
        matchMode: step.conditionMatchMode,
        text: execution.replyMessage || execution.triggerMessage,
      });
      const targetIndex = Number(step.jumpToStep || 0) - 1;

      pushHistory(
        execution,
        stepIndex,
        "condition",
        matched
          ? `Matched "${step.conditionKeyword}", jumped to step ${step.jumpToStep}`
          : `No match for "${step.conditionKeyword}"`
      );

      if (matched && targetIndex >= 0 && targetIndex < flow.steps.length) {
        execution.currentStepIndex = targetIndex;
        continue;
      }
    }

    if (step.type === "handoff") {
      await Message.updateMany(
        { userId: execution.userId, phone: execution.phone },
        { needsAgent: true }
      );

      execution.status = "handoff";
      execution.nextRunAt = null;
      execution.currentStepIndex += 1;
      pushHistory(execution, stepIndex, "handoff", step.label || "Human handoff");
      await execution.save();
      return execution;
    }

    execution.currentStepIndex += 1;
  }

  if (guard >= 100) {
    execution.status = "failed";
    execution.errorReason = "Flow stopped because a branch loop was detected";
    pushHistory(execution, execution.currentStepIndex, "failed", execution.errorReason);
    await execution.save();
    return execution;
  }

  execution.status = "completed";
  execution.nextRunAt = null;
  await execution.save();
  return execution;
};

const triggerFlowsForInbound = async ({
  userId,
  phone,
  name = "",
  message = "",
  source = "inbound",
  campaignId = null,
}) => {
  if (!userId || !phone || !message) return [];

  const normalizedPhone = normalizePhone(phone);
  const flows = await MessageFlow.find({ userId, status: "active" }).sort({
    createdAt: 1,
  });
  const matchedFlows = flows.filter(
    (flow) => matchesSource(flow, { source, campaignId }) && matchesTrigger(flow, message)
  );
  const started = [];

  for (const flow of matchedFlows) {
    const contact = await findOrCreateContact({
      userId,
      phone: normalizedPhone,
      name,
    });

    const execution = await FlowExecution.create({
      flowId: flow._id,
      userId,
      contactId: contact._id,
      phone: normalizedPhone,
      name: contact.name || name || "",
      status: "running",
      triggerMessage: message,
      replyMessage: "",
      awaitingStepIndex: null,
      currentStepIndex: 0,
    });

    flow.runs += 1;
    flow.lastTriggeredAt = new Date();
    await flow.save();

    started.push(await runExecution(execution));
  }

  return started;
};

const resumeAwaitingReplyFlows = async ({ userId, phone, message = "" }) => {
  if (!userId || !phone || !message) return [];

  const normalizedPhone = normalizePhone(phone);
  const executions = await FlowExecution.find({
    userId,
    phone: normalizedPhone,
    status: "awaiting_reply",
  })
    .sort({ updatedAt: -1 })
    .limit(5);
  const resumed = [];

  for (const execution of executions) {
    execution.status = "running";
    execution.replyMessage = message;
    execution.nextRunAt = null;
    execution.awaitingStepIndex = null;
    pushHistory(execution, execution.currentStepIndex, "reply", message);
    await execution.save();
    resumed.push(await runExecution(execution));
  }

  return resumed;
};

const processDueFlowExecutions = async () => {
  const dueTimed = await FlowExecution.find({
    status: { $in: ["waiting", "awaiting_reply"] },
    nextRunAt: { $lte: new Date() },
  }).limit(50);

  for (const execution of dueTimed) {
    if (execution.status === "awaiting_reply" && execution.awaitingStepIndex !== null) {
      const flow = await MessageFlow.findOne({
        _id: execution.flowId,
        userId: execution.userId,
      });
      const waitStep = flow?.steps?.[execution.awaitingStepIndex];
      const targetIndex = Number(waitStep?.noReplyJumpToStep || 0) - 1;

      if (flow && targetIndex >= 0 && targetIndex < flow.steps.length) {
        execution.currentStepIndex = targetIndex;
      }

      execution.replyMessage = "";
      execution.awaitingStepIndex = null;
      pushHistory(execution, execution.currentStepIndex, "no_reply", "No reply follow-up");
    }

    execution.status = "running";
    execution.nextRunAt = null;
    await execution.save();
    await runExecution(execution);
  }
};

module.exports = {
  normalizePhone,
  processDueFlowExecutions,
  resumeAwaitingReplyFlows,
  triggerFlowsForInbound,
};
