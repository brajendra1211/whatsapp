const AppSetting = require("../models/AppSetting");

const WEBHOOK_VERIFY_TOKEN_KEY = "webhook_verify_token";

const normalizeToken = (token = "") => String(token || "").trim();

const getSavedWebhookVerifyToken = async () => {
  const setting = await AppSetting.findOne({ key: WEBHOOK_VERIFY_TOKEN_KEY }).lean();
  return normalizeToken(setting?.value);
};

const getWebhookVerifyTokens = async () => {
  let savedToken = "";

  try {
    savedToken = await getSavedWebhookVerifyToken();
  } catch (error) {
    console.error("Webhook verify token lookup warning:", error.message);
  }

  const tokens = [normalizeToken(process.env.WEBHOOK_VERIFY_TOKEN), savedToken].filter(Boolean);

  return [...new Set(tokens)];
};

const saveWebhookVerifyToken = async ({ token, userId }) => {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    throw new Error("Verify token is required");
  }

  return AppSetting.findOneAndUpdate(
    { key: WEBHOOK_VERIFY_TOKEN_KEY },
    {
      value: normalizedToken,
      updatedBy: userId || null,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const buildWebhookCallbackUrls = (req) => {
  const configuredUrl = normalizeToken(process.env.WEBHOOK_CALLBACK_URL);
  const configuredBase = normalizeToken(process.env.WEBHOOK_CALLBACK_BASE_URL);
  const requestBase = `${req.protocol}://${req.get("host")}`;
  const base = (configuredBase || requestBase).replace(/\/+$/, "");

  return {
    primary: configuredUrl || `${base}/webhook`,
    inboxAlias: `${base}/inbox`,
  };
};

module.exports = {
  buildWebhookCallbackUrls,
  getSavedWebhookVerifyToken,
  getWebhookVerifyTokens,
  saveWebhookVerifyToken,
};
