const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncMetaTemplateStatuses,
} = require("../controllers/templateController");

router.get("/list", authMiddleware, listTemplates);
router.post("/add", authMiddleware, createTemplate);
router.put("/update/:id", authMiddleware, updateTemplate);
router.delete("/delete/:id", authMiddleware, deleteTemplate);
router.get("/sync-meta", authMiddleware, syncMetaTemplateStatuses);

module.exports = router;