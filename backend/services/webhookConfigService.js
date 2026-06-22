const AppSetting = require("../models/AppSetting");

const WEBHOOK_VERIFY_TOKEN_KEY = "webhook_verify_token";

const normalizeToken = (token = "") => String(token || "").trim();
const getUserTokenKey = (userId) =>
  userId ? `${WEBHOOK_VERIFY_TOKEN_KEY}:${String(userId)}` : WEBHOOK_VERIFY_TOKEN_KEY;

const getSavedWebhookVerifyToken = async (userId) => {
  const setting = await AppSetting.findOne({ key: getUserTokenKey(userId) }).lean();
  if (normalizeToken(setting?.value)) return normalizeToken(setting.value);

  if (!userId) return "";

  const legacySetting = await AppSetting.findOne({ key: WEBHOOK_VERIFY_TOKEN_KEY }).lean();
  return normalizeToken(legacySetting?.value);
};

const getSavedWebhookVerifyTokens = async () => {
  const settings = await AppSetting.find({
    key: { $regex: `^${WEBHOOK_VERIFY_TOKEN_KEY}(:|$)` },
  }).lean();

  return settings.map((setting) => normalizeToken(setting.value)).filter(Boolean);
};

const getWebhookVerifyTokens = async () => {
  let savedTokens = [];

  try {
    savedTokens = await getSavedWebhookVerifyTokens();
  } catch (error) {
    console.error("Webhook verify token lookup warning:", error.message);
  }

  const tokens = [
    normalizeToken(process.env.WEBHOOK_VERIFY_TOKEN),
    normalizeToken(process.env.META_VERIFY_TOKEN),
    ...savedTokens,
  ].filter(Boolean);

  return [...new Set(tokens)];
};

const saveWebhookVerifyToken = async ({ token, userId }) => {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    throw new Error("Verify token is required");
  }

  return AppSetting.findOneAndUpdate(
    { key: getUserTokenKey(userId) },
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
