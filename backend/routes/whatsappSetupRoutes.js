const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  connectWhatsApp,
  getConnectionStatus,
  getSetupConfig,
  saveWebhookConfig,
} = require("../controllers/whatsappSetupController");

const router = express.Router();

router.get("/config", authMiddleware, getSetupConfig);
router.get("/status", authMiddleware, getConnectionStatus);
router.post("/connect", authMiddleware, connectWhatsApp);
router.post("/webhook-config", authMiddleware, saveWebhookConfig);

module.exports = router;
