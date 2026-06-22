const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const getRuntimeConfig = (credentials = {}) => ({
  phoneNumberId: credentials.phoneNumberId || PHONE_NUMBER_ID,
  token: credentials.accessToken || TOKEN,
});

const getBaseUrl = (credentials = {}) => {
  const { phoneNumberId } = getRuntimeConfig(credentials);
  return `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`;
};

const assertWhatsAppConfig = (credentials = {}) => {
  const { phoneNumberId, token } = getRuntimeConfig(credentials);
  const missing = [];

  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!token) missing.push("WHATSAPP_TOKEN");

  if (missing.length) {
    throw new Error(`Missing WhatsApp configuration: ${missing.join(", ")}`);
  }
};

const getHeaders = (credentials = {}) => ({
  Authorization: `Bearer ${getRuntimeConfig(credentials).token}`,
  "Content-Type": "application/json",
});

const uploadMedia = async (filePath, mimeType, credentials = {}) => {
  assertWhatsAppConfig(credentials);

  const form = new FormData();

  form.append("messaging_product", "whatsapp");
  form.append("file", fs.createReadStream(filePath), {
    contentType: mimeType,
  });

  const response = await axios.post(`${getBaseUrl(credentials)}/media`, form, {
    headers: {
      Authorization: `Bearer ${getRuntimeConfig(credentials).token}`,
      ...form.getHeaders(),
    },
    maxBodyLength: Infinity,
  });

  return response.data.id;
};

const sendTextMessage = async ({ to, body, credentials = {} }) => {
  assertWhatsAppConfig(credentials);

  const response = await axios.post(
    `${getBaseUrl(credentials)}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: true,
        body,
      },
    },
    { headers: getHeaders(credentials) }
  );

  return response.data;
};

const sendInteractiveButtonsMessage = async ({ to, body, buttons, credentials = {} }) => {
  assertWhatsAppConfig(credentials);

  const response = await axios.post(
    `${getBaseUrl(credentials)}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.slice(0, 3).map((btn, index) => ({
            type: "reply",
            reply: {
              id: btn.id || `btn_${index + 1}`,
              title: btn.title || btn.text || "Reply",
            },
          })),
        },
      },
    },
    { headers: getHeaders(credentials) }
  );

  return response.data;
};

const sendTemplateMessage = async ({
  to,
  templateName,
  language = "en_US",
  parameters = [],
  credentials = {},
}) => {
  assertWhatsAppConfig(credentials);

  const components = parameters.length
    ? [
        {
          type: "body",
          parameters: parameters.map((text) => ({
            type: "text",
            text,
          })),
        },
      ]
    : [];

  const response = await axios.post(
    `${getBaseUrl(credentials)}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    },
    { headers: getHeaders(credentials) }
  );

  return response.data;
};

const sendMediaMessage = async ({ to, filePath, mimeType, caption = "", credentials = {} }) => {
  const mediaId = await uploadMedia(filePath, mimeType, credentials);

  const isImage = mimeType.startsWith("image/");
  const type = isImage ? "image" : "document";

  const payload = {
    messaging_product: "whatsapp",
    to,
    type,
    [type]: {
      id: mediaId,
      caption,
    },
  };

  if (type === "document") {
    payload.document = {
      id: mediaId,
      caption,
      filename: filePath.split(/[\\/]/).pop(),
    };
  }

  const response = await axios.post(`${getBaseUrl(credentials)}/messages`, payload, {
    headers: getHeaders(credentials),
  });

  return response.data;
};

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  sendInteractiveButtonsMessage,
  sendMediaMessage,
};
