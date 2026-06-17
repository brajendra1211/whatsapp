const axios = require("axios");
const WhatsAppConnection = require("../models/WhatsAppConnection");
const {
  buildWebhookCallbackUrls,
  getSavedWebhookVerifyToken,
  saveWebhookVerifyToken,
} = require("../services/webhookConfigService");
const {
  getMetaAppConfig,
  saveMetaAppConfig,
} = require("../services/metaAppConfigService");

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

const requireMetaAppConfig = async (userId) => {
  const metaConfig = await getMetaAppConfig(userId);
  const missing = [];

  if (!metaConfig.appId) missing.push("META_APP_ID");
  if (!metaConfig.appSecret) missing.push("META_APP_SECRET");
  if (!metaConfig.configId) {
    missing.push("META_EMBEDDED_SIGNUP_CONFIG_ID");
  }

  if (missing.length) {
    throw new Error(`Missing Meta app configuration: ${missing.join(", ")}`);
  }

  return metaConfig;
};

const getGraphErrorMessage = (error) => {
  const graphError = error?.response?.data?.error;
  if (!graphError) return error.message || "Meta setup failed";

  return [
    graphError.message,
    graphError.error_user_title,
    graphError.error_user_msg,
    graphError.error_data?.details,
  ]
    .filter(Boolean)
    .join(" - ");
};

exports.getSetupConfig = async (req, res) => {
  try {
    const savedVerifyToken = await getSavedWebhookVerifyToken(req.user?._id);
    const callbackUrls = buildWebhookCallbackUrls(req);
    const metaConfig = await getMetaAppConfig(req.user?._id);

    return res.json({
      appId: metaConfig.appId,
      configId: metaConfig.configId,
      apiVersion: metaConfig.apiVersion,
      hasMetaAppSecret: metaConfig.hasAppSecret,
      metaAppConfigSource: metaConfig.source,
      webhookCallbackUrl: callbackUrls.primary,
      inboxWebhookCallbackUrl: callbackUrls.inboxAlias,
      hasWebhookVerifyToken: Boolean(process.env.WEBHOOK_VERIFY_TOKEN || savedVerifyToken),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load setup config" });
  }
};

exports.saveWebhookConfig = async (req, res) => {
  try {
    const { verifyToken } = req.body;
    await saveWebhookVerifyToken({
      token: verifyToken,
      userId: req.user?._id,
    });

    const callbackUrls = buildWebhookCallbackUrls(req);

    return res.json({
      message: "Webhook verify token saved",
      webhookCallbackUrl: callbackUrls.primary,
      inboxWebhookCallbackUrl: callbackUrls.inboxAlias,
      hasWebhookVerifyToken: true,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to save webhook config" });
  }
};

exports.saveMetaAppConfig = async (req, res) => {
  try {
    const { appId, appSecret, configId } = req.body;

    await saveMetaAppConfig({
      appId,
      appSecret,
      configId,
      userId: req.user?._id,
    });

    const metaConfig = await getMetaAppConfig(req.user?._id);

    return res.json({
      message: "Meta app configuration saved",
      appId: metaConfig.appId,
      configId: metaConfig.configId,
      apiVersion: metaConfig.apiVersion,
      hasMetaAppSecret: metaConfig.hasAppSecret,
      metaAppConfigSource: metaConfig.source,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to save Meta app config" });
  }
};

exports.getConnectionStatus = async (req, res) => {
  try {
    const connection = await WhatsAppConnection.findOne({
      userId: req.user._id,
      status: "connected",
    }).select("-accessToken -raw");

    return res.json({
      connected: Boolean(connection),
      connection,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load WhatsApp status" });
  }
};

exports.connectWhatsApp = async (req, res) => {
  try {
    const metaConfig = await requireMetaAppConfig(req.user._id);

    const {
      code,
      waba_id,
      phone_number_id,
      business_id = "",
      session = {},
    } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Facebook auth code is required" });
    }

    if (!waba_id || !phone_number_id) {
      return res.status(400).json({
        message: "WABA ID and phone number ID are required from embedded signup",
      });
    }

    const tokenRes = await axios.get(
      `https://graph.facebook.com/${metaConfig.apiVersion || API_VERSION}/oauth/access_token`,
      {
        params: {
          client_id: metaConfig.appId,
          client_secret: metaConfig.appSecret,
          code,
        },
      }
    );

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      return res.status(400).json({ message: "Meta did not return an access token" });
    }

    try {
      await axios.post(
        `https://graph.facebook.com/${metaConfig.apiVersion || API_VERSION}/${waba_id}/subscribed_apps`,
        null,
        {
          params: { access_token: accessToken },
        }
      );
    } catch (subscribeError) {
      console.error("WABA subscribe warning:", getGraphErrorMessage(subscribeError));
    }

    const connection = await WhatsAppConnection.findOneAndUpdate(
      { userId: req.user._id },
      {
        accessToken,
        wabaId: waba_id,
        phoneNumberId: phone_number_id,
        businessId: business_id,
        status: "connected",
        raw: {
          session,
          tokenType: tokenRes.data?.token_type || "",
        },
        connectedAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select("-accessToken -raw");

    return res.json({
      message: "WhatsApp connected successfully",
      connected: true,
      connection,
    });
  } catch (error) {
    console.error("connectWhatsApp error:", getGraphErrorMessage(error));
    return res.status(400).json({
      message: getGraphErrorMessage(error),
      metaError: error?.response?.data?.error || null,
    });
  }
};
