const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createFlow,
  deleteFlow,
  getFlowAnalytics,
  listExecutions,
  listFlows,
  simulateFlow,
  updateFlow,
} = require("../controllers/messageFlowController");

const router = express.Router();

router.get("/", authMiddleware, listFlows);
router.get("/analytics/summary", authMiddleware, getFlowAnalytics);
router.get("/executions/list", authMiddleware, listExecutions);
router.post("/simulate", authMiddleware, simulateFlow);
router.post("/", authMiddleware, createFlow);
router.put("/:id", authMiddleware, updateFlow);
router.delete("/:id", authMiddleware, deleteFlow);

module.exports = router;
