const AppSetting = require("../models/AppSetting");

const META_APP_CONFIG_KEY = "meta_app_config";

const cleanValue = (value = "") => String(value || "").trim();
const getUserConfigKey = (userId) =>
  userId ? `${META_APP_CONFIG_KEY}:${String(userId)}` : META_APP_CONFIG_KEY;

const getSettingValue = async (key) => {
  const setting = await AppSetting.findOne({ key }).lean();
  return setting?.value && typeof setting.value === "object" ? setting.value : {};
};

const getSavedMetaAppConfig = async (userId) => {
  if (!userId) return getSettingValue(META_APP_CONFIG_KEY);

  const userConfig = await getSettingValue(getUserConfigKey(userId));
  if (Object.keys(userConfig).length) return userConfig;

  return getSettingValue(META_APP_CONFIG_KEY);
};

const getMetaAppConfig = async (userId) => {
  let savedConfig = {};
  let legacyConfig = {};

  try {
    savedConfig = userId ? await getSettingValue(getUserConfigKey(userId)) : {};
    legacyConfig = await getSettingValue(META_APP_CONFIG_KEY);
  } catch (error) {
    console.error("Meta app config lookup warning:", error.message);
  }

  const envAppId = cleanValue(process.env.META_APP_ID);
  const envAppSecret = cleanValue(process.env.META_APP_SECRET);
  const envConfigId = cleanValue(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID);

  const savedAppId = cleanValue(savedConfig.appId);
  const savedAppSecret = cleanValue(savedConfig.appSecret);
  const savedConfigId = cleanValue(savedConfig.configId);

  const legacyAppId = cleanValue(legacyConfig.appId);
  const legacyAppSecret = cleanValue(legacyConfig.appSecret);
  const legacyConfigId = cleanValue(legacyConfig.configId);

  const appId = savedAppId || envAppId || legacyAppId;
  const appSecret = savedAppSecret || envAppSecret || legacyAppSecret;
  const configId = savedConfigId || envConfigId || legacyConfigId;

  return {
    appId,
    appSecret,
    configId,
    apiVersion: cleanValue(process.env.WHATSAPP_API_VERSION) || "v21.0",
    hasAppSecret: Boolean(appSecret),
    source: {
      appId: savedAppId ? "user_settings" : envAppId ? "env" : legacyAppId ? "legacy_settings" : "",
      appSecret: savedAppSecret
        ? "user_settings"
        : envAppSecret
          ? "env"
          : legacyAppSecret
            ? "legacy_settings"
            : "",
      configId: savedConfigId
        ? "user_settings"
        : envConfigId
          ? "env"
          : legacyConfigId
            ? "legacy_settings"
            : "",
    },
  };
};

const saveMetaAppConfig = async ({ appId, appSecret, configId, userId }) => {
  if (!userId) {
    throw new Error("Login user is required to save Meta app configuration");
  }

  const current = await getSavedMetaAppConfig(userId);

  const nextConfig = {
    ...current,
    appId: cleanValue(appId),
    configId: cleanValue(configId),
  };

  const normalizedSecret = cleanValue(appSecret);
  if (normalizedSecret) {
    nextConfig.appSecret = normalizedSecret;
  }

  if (!nextConfig.appId) {
    throw new Error("Meta App ID is required");
  }

  if (!nextConfig.configId) {
    throw new Error("Embedded Signup Config ID is required");
  }

  if (!cleanValue(process.env.META_APP_SECRET) && !cleanValue(nextConfig.appSecret)) {
    throw new Error("Meta App Secret is required");
  }

  return AppSetting.findOneAndUpdate(
    { key: getUserConfigKey(userId) },
    {
      value: nextConfig,
      updatedBy: userId || null,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

module.exports = {
  getMetaAppConfig,
  saveMetaAppConfig,
};
