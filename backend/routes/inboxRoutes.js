const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getConversations,
  getContactTimeline,
  getMessagesByPhone,
  sendReply,
  updateContactProfileByPhone,
  updateConversationState,
} = require("../controllers/inboxController");

router.get("/conversations", authMiddleware, getConversations);
router.get("/messages/:phone", authMiddleware, getMessagesByPhone);
router.get("/timeline/:phone", authMiddleware, getContactTimeline);
router.put("/contact-profile/:phone", authMiddleware, updateContactProfileByPhone);
router.put("/state/:phone", authMiddleware, updateConversationState);
router.post("/reply", authMiddleware, sendReply);

module.exports = router;
