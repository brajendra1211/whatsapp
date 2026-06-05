const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  listAudiences,
  createAudience,
  updateAudience,
  deleteAudience,
} = require("../controllers/audienceController");

router.get("/test", (req, res) => {
  res.json({ message: "audience route working" });
});

router.get("/list", authMiddleware, listAudiences);
router.post("/add", authMiddleware, createAudience);
router.put("/update/:id", authMiddleware, updateAudience);
router.delete("/delete/:id", authMiddleware, deleteAudience);

module.exports = router;