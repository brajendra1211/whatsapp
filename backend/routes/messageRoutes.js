const express = require("express");
const multer = require("multer");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  sendTestMessage,
  sendCampaign,
  getCampaignHistory,
  getDeliveryStatus,
  getFailedReport,
  getAnalytics,
} = require("../controllers/messageController");

const upload = multer({ dest: "uploads/" });

router.get("/message-test", (req, res) => {
  res.json({ message: "message routes working" });
});

router.post(
  "/message/send-test",
  authMiddleware,
  upload.single("media"),
  sendTestMessage
);

router.post(
  "/message/send-campaign",
  authMiddleware,
  upload.single("media"),
  sendCampaign
);

router.get("/campaign/history", authMiddleware, getCampaignHistory);
router.get("/campaign/delivery-status", authMiddleware, getDeliveryStatus);
router.get("/campaign/failed-report", authMiddleware, getFailedReport);
router.get("/campaign/analytics", authMiddleware, getAnalytics);

module.exports = router;