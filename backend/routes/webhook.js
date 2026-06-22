const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Campaign = require("../models/Campaign");
const Contact = require("../models/Contact");
const WhatsAppConnection = require("../models/WhatsAppConnection");
const {
  resumeAwaitingReplyFlows,
  triggerFlowsForInbound,
} = require("../services/messageFlowService");
const { getWebhookVerifyTokens } = require("../services/webhookConfigService");

const isOptOutText = (text = "") => {
  const body = String(text || "").trim().toLowerCase();
  return ["stop", "unsubscribe", "opt out", "optout", "cancel"].includes(body);
};

const normalizePhone = (phone = "") => {
  let clean = String(phone || "").replace(/[^\d]/g, "");

  if (clean.startsWith("0")) {
    clean = clean.slice(1);
  }

  if (clean.length === 10) {
    clean = `91${clean}`;
  }

  return clean;
};

const getInboundText = (message = {}) => {
  if (message.text?.body) return message.text.body;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  return "";
};

const findConnectionForWebhook = async (phoneNumberId) => {
  if (phoneNumberId) {
    const connection = await WhatsAppConnection.findOne({
      phoneNumberId,
      status: "connected",
    });

    if (connection) return connection;
  }

  return WhatsAppConnection.findOne({ status: "connected" }).sort({ connectedAt: -1 });
};

router.get("/", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyTokens = await getWebhookVerifyTokens();

  if (mode === "subscribe" && verifyTokens.includes(token)) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    const statuses = body?.entry?.[0]?.changes?.[0]?.value?.statuses || [];
    const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
    const metadata = body?.entry?.[0]?.changes?.[0]?.value?.metadata || {};
    const contacts = body?.entry?.[0]?.changes?.[0]?.value?.contacts || [];

    if (statuses.length || messages.length) {
      console.log("WhatsApp webhook received", {
        statuses: statuses.length,
        messages: messages.length,
        phoneNumberId: metadata.phone_number_id || "",
      });
    }

    const contactByWaId = new Map(
      contacts.map((contact) => [
        normalizePhone(contact.wa_id || contact.input || ""),
        contact.profile?.name || "",
      ])
    );

    for (const statusObj of statuses) {
      const waMessageId = statusObj.id;
      const status = statusObj.status;

      const msg = await Message.findOne({ waMessageId });
      if (!msg) continue;

      if (status === "sent") msg.status = "sent";
      if (status === "delivered") msg.status = "delivered";
      if (status === "read") msg.status = "read";

      await msg.save();

      if (msg.campaignId) {
        const sent = await Message.countDocuments({
          campaignId: msg.campaignId,
          status: { $in: ["sent", "delivered", "read", "replied"] },
        });

        const delivered = await Message.countDocuments({
          campaignId: msg.campaignId,
          status: { $in: ["delivered", "read", "replied"] },
        });

        const read = await Message.countDocuments({
          campaignId: msg.campaignId,
          status: { $in: ["read", "replied"] },
        });

        const replied = await Message.countDocuments({
          campaignId: msg.campaignId,
          status: "replied",
        });

        const failed = await Message.countDocuments({
          campaignId: msg.campaignId,
          status: "failed",
        });

        await Campaign.findByIdAndUpdate(msg.campaignId, {
          sent,
          delivered,
          read,
          replied,
          failed,
        });
      }
    }

    for (const inbound of messages) {
      const from = normalizePhone(inbound.from || "");
      const text = getInboundText(inbound);
      const waMessageId = inbound.id || "";
      const contactName = contactByWaId.get(from) || "";

      if (!from) {
        console.warn("Webhook inbound skipped: missing sender phone", inbound);
        continue;
      }

      if (waMessageId) {
        const existingInbound = await Message.findOne({ waMessageId });
        if (existingInbound) {
          continue;
        }
      }

      const connection = await findConnectionForWebhook(metadata.phone_number_id);
      const userId = connection?.userId || null;
      const existingOutbound = await Message.findOne({
        phone: from,
        direction: "outbound",
        ...(userId ? { userId } : {}),
      }).sort({ createdAt: -1 });
      const resolvedUserId = userId || existingOutbound?.userId || null;

      if (!resolvedUserId) {
        console.warn("Webhook inbound skipped: no user resolved", {
          from,
          phoneNumberId: metadata.phone_number_id,
        });
        continue;
      }

      const optedOut = isOptOutText(text);
      const contact = await Contact.findOneAndUpdate(
        {
          userId: resolvedUserId,
          phone: from,
        },
        {
          $setOnInsert: {
            userId: resolvedUserId,
            phone: from,
            name: existingOutbound?.name || contactName || from,
          },
          ...(optedOut
            ? {
                $set: {
                  optOut: true,
                  optOutAt: new Date(),
                  optOutReason: "WhatsApp STOP keyword",
                },
                $addToSet: { tags: "Opted Out" },
              }
            : {}),
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      await Message.create({
        campaignId: existingOutbound?.campaignId || null,
        contactId: existingOutbound?.contactId || contact?._id || null,
        userId: resolvedUserId,
        phone: from,
        name: existingOutbound?.name || contact?.name || contactName || "",
        direction: "inbound",
        type: "text",
        message: text,
        waMessageId,
        status: "replied",
      });

      if (existingOutbound?.campaignId) {
        await Message.findOneAndUpdate(
          { campaignId: existingOutbound.campaignId, phone: from, direction: "outbound" },
          { status: "replied" },
          { sort: { createdAt: -1 } }
        );

        const replied = await Message.countDocuments({
          campaignId: existingOutbound.campaignId,
          status: "replied",
        });

        await Campaign.findByIdAndUpdate(existingOutbound.campaignId, { replied });
      }

      if (optedOut) {
        continue;
      }

      if (resolvedUserId) {
        const resumed = await resumeAwaitingReplyFlows({
          userId: resolvedUserId,
          phone: from,
          message: text,
        });

        if (resumed.length) {
          continue;
        }

        await triggerFlowsForInbound({
          userId: resolvedUserId,
          phone: from,
          name: existingOutbound?.name || contactName || "",
          message: text,
          source: existingOutbound?.campaignId ? "campaign_reply" : "inbound",
          campaignId: existingOutbound?.campaignId || null,
        });
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.sendStatus(200);
  }
});

module.exports = router;
