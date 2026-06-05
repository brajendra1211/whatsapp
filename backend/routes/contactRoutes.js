const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const {
  listContacts,
  addContact,
  updateContact,
  deleteContact,
  importContacts,
  bulkTagContacts,
  bulkAddToAudience,
  updateLeadProfile,
} = require("../controllers/contactController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/list", authMiddleware, listContacts);
router.post("/add", authMiddleware, addContact);
router.put("/update/:id", authMiddleware, updateContact);
router.put("/lead-profile/:id", authMiddleware, updateLeadProfile);
router.delete("/delete/:id", authMiddleware, deleteContact);
router.post("/import", authMiddleware, upload.single("file"), importContacts);
router.post("/bulk-tag", authMiddleware, bulkTagContacts);
router.post("/bulk-audience", authMiddleware, bulkAddToAudience);

module.exports = router;
