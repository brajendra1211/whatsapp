const axios = require("axios");

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

const getRuntimeConfig = (credentials = {}) => ({
  wabaId: credentials.wabaId || WABA_ID,
  token: credentials.accessToken || TOKEN,
});

const getHeaders = (credentials = {}) => ({
  Authorization: `Bearer ${getRuntimeConfig(credentials).token}`,
  "Content-Type": "application/json",
});

const assertMetaConfig = (credentials = {}) => {
  const { wabaId, token } = getRuntimeConfig(credentials);
  const missing = [];

  if (!wabaId) missing.push("WHATSAPP_BUSINESS_ACCOUNT_ID");
  if (!token) missing.push("WHATSAPP_TOKEN");

  if (missing.length) {
    throw new Error(`Missing Meta template configuration: ${missing.join(", ")}`);
  }
};

const sanitizeTemplateName = (name = "") => {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 512);
};

const extractBodyVariables = (content = "") => {
  const matches = String(content).match(/\{\{\d+\}\}/g) || [];

  return [...new Set(matches)].sort((a, b) => {
    const left = Number(a.replace(/\D/g, ""));
    const right = Number(b.replace(/\D/g, ""));
    return left - right;
  });
};

const buildMetaComponents = ({ content, buttons = [] }) => {
  const bodyComponent = {
    type: "BODY",
    text: content,
  };

  const variables = extractBodyVariables(content);
  if (variables.length) {
    bodyComponent.example = {
      body_text: [
        variables.map((variable, index) => {
          if (index === 0) return "Customer";
          if (index === 1) return "Offer";
          return `Sample ${variable.replace(/\D/g, "")}`;
        }),
      ],
    };
  }

  const components = [bodyComponent];

  const metaButtons = buttons
    .filter((b) => b.text)
    .slice(0, 3);

  if (metaButtons.length) {
    components.push({
      type: "BUTTONS",
      buttons: metaButtons.map((btn) => {
        if (btn.type === "url") {
          return {
            type: "URL",
            text: btn.text,
            url: btn.value,
          };
        }

        if (btn.type === "call") {
          return {
            type: "PHONE_NUMBER",
            text: btn.text,
            phone_number: btn.value,
          };
        }

        return {
          type: "QUICK_REPLY",
          text: btn.text,
        };
      }),
    });
  }

  return components;
};

exports.createMetaTemplate = async ({
  name,
  content,
  category,
  language = "en_US",
  buttons = [],
  credentials = {},
}) => {
  assertMetaConfig(credentials);
  const { wabaId } = getRuntimeConfig(credentials);

  const payload = {
    name: sanitizeTemplateName(name),
    category,
    language,
    components: buildMetaComponents({ content, buttons }),
  };

  const res = await axios.post(
    `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`,
    payload,
    { headers: getHeaders(credentials) }
  );

  return res.data;
};

exports.fetchMetaTemplates = async (credentials = {}) => {
  assertMetaConfig(credentials);
  const { wabaId } = getRuntimeConfig(credentials);

  const res = await axios.get(
    `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`,
    { headers: getHeaders(credentials) }
  );

  return res.data;
};
