const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  connectWhatsApp,
  getConnectionStatus,
  getSetupConfig,
  saveMetaAppConfig,
  saveWebhookConfig,
} = require("../controllers/whatsappSetupController");

const router = express.Router();

router.get("/config", authMiddleware, getSetupConfig);
router.get("/status", authMiddleware, getConnectionStatus);
router.post("/connect", authMiddleware, connectWhatsApp);
router.post("/meta-app-config", authMiddleware, saveMetaAppConfig);
router.post("/webhook-config", authMiddleware, saveWebhookConfig);

module.exports = router;
