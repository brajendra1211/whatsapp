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
      const from = inbound.from || "";
      const text = inbound.text?.body || "";
      const waMessageId = inbound.id || "";
      const contactName = inbound.profile?.name || "";

      const connection = metadata.phone_number_id
        ? await WhatsAppConnection.findOne({
            phoneNumberId: metadata.phone_number_id,
            status: "connected",
          })
        : null;
      const userId = connection?.userId || null;
      const existingOutbound = await Message.findOne({
        phone: from,
        direction: "outbound",
        ...(userId ? { userId } : {}),
      }).sort({ createdAt: -1 });
      const resolvedUserId = userId || existingOutbound?.userId || null;

      if (!resolvedUserId) {
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
    return res.sendStatus(200);
  }
});

module.exports = router;
