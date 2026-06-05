const FlowExecution = require("../models/FlowExecution");
const MessageFlow = require("../models/MessageFlow");

const sanitizeSteps = (steps = []) => {
  return steps
    .filter((step) => step && step.type)
    .map((step) => ({
      type: step.type,
      message: String(step.message || "").trim(),
      delayMinutes: Math.max(0, Number(step.delayMinutes || 0)),
      label: String(step.label || "").trim(),
      tag: String(step.tag || "").trim(),
      conditionKeyword: String(step.conditionKeyword || "").trim(),
      conditionMatchMode: step.conditionMatchMode === "exact" ? "exact" : "contains",
      jumpToStep: Math.max(0, Number(step.jumpToStep || 0)),
      noReplyDelayMinutes: Math.max(0, Number(step.noReplyDelayMinutes || 0)),
      noReplyJumpToStep: Math.max(0, Number(step.noReplyJumpToStep || 0)),
      templateId: step.templateId || null,
      audienceId: step.audienceId || null,
    }));
};

exports.listFlows = async (req, res) => {
  try {
    const flows = await MessageFlow.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json({ flows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load message flows" });
  }
};

exports.createFlow = async (req, res) => {
  try {
    const {
      name,
      triggerKeyword,
      matchMode = "contains",
      status = "active",
      triggerSource = "all",
      campaignId = null,
    } = req.body;
    const steps = sanitizeSteps(req.body.steps || []);

    if (!name || !triggerKeyword) {
      return res.status(400).json({ message: "Flow name and trigger keyword are required" });
    }

    if (!steps.length) {
      return res.status(400).json({ message: "At least one flow step is required" });
    }

    const flow = await MessageFlow.create({
      userId: req.user._id,
      name,
      triggerKeyword,
      matchMode,
      status,
      triggerSource,
      campaignId: campaignId || null,
      steps,
    });

    return res.json({ message: "Message flow created", flow });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create message flow" });
  }
};

exports.updateFlow = async (req, res) => {
  try {
    const {
      name,
      triggerKeyword,
      matchMode = "contains",
      status = "active",
      triggerSource = "all",
      campaignId = null,
    } = req.body;
    const steps = sanitizeSteps(req.body.steps || []);

    if (!name || !triggerKeyword) {
      return res.status(400).json({ message: "Flow name and trigger keyword are required" });
    }

    if (!steps.length) {
      return res.status(400).json({ message: "At least one flow step is required" });
    }

    const flow = await MessageFlow.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        name,
        triggerKeyword,
        matchMode,
        status,
        triggerSource,
        campaignId: campaignId || null,
        steps,
      },
      { new: true }
    );

    if (!flow) {
      return res.status(404).json({ message: "Message flow not found" });
    }

    return res.json({ message: "Message flow updated", flow });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update message flow" });
  }
};

exports.deleteFlow = async (req, res) => {
  try {
    const flow = await MessageFlow.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!flow) {
      return res.status(404).json({ message: "Message flow not found" });
    }

    await FlowExecution.deleteMany({ flowId: flow._id, userId: req.user._id });

    return res.json({ message: "Message flow deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete message flow" });
  }
};

exports.listExecutions = async (req, res) => {
  try {
    const executions = await FlowExecution.find({ userId: req.user._id })
      .populate("flowId", "name triggerKeyword")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ executions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load flow activity" });
  }
};

exports.getFlowAnalytics = async (req, res) => {
  try {
    const flows = await MessageFlow.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    const executions = await FlowExecution.find({ userId: req.user._id }).select(
      "flowId status currentStepIndex history"
    );
    const analyticsByFlow = {};
    const totals = {
      entered: 0,
      completed: 0,
      handoff: 0,
      failed: 0,
      awaitingReply: 0,
      waiting: 0,
    };

    for (const flow of flows) {
      const stepDropOff = flow.steps.map((step, index) => ({
        stepIndex: index,
        stepNumber: index + 1,
        type: step.type,
        label:
          step.label ||
          step.message ||
          step.tag ||
          step.conditionKeyword ||
          step.type,
        count: 0,
      }));

      analyticsByFlow[String(flow._id)] = {
        flowId: flow._id,
        entered: 0,
        completed: 0,
        handoff: 0,
        failed: 0,
        awaitingReply: 0,
        waiting: 0,
        running: 0,
        completionRate: 0,
        handoffRate: 0,
        dropOff: stepDropOff,
      };
    }

    for (const execution of executions) {
      const flowId = String(execution.flowId);
      const item = analyticsByFlow[flowId];

      if (!item) continue;

      item.entered += 1;
      totals.entered += 1;

      if (execution.status === "completed") {
        item.completed += 1;
        totals.completed += 1;
      } else if (execution.status === "handoff") {
        item.handoff += 1;
        totals.handoff += 1;
      } else if (execution.status === "failed") {
        item.failed += 1;
        totals.failed += 1;
      } else if (execution.status === "awaiting_reply") {
        item.awaitingReply += 1;
        totals.awaitingReply += 1;
      } else if (execution.status === "waiting") {
        item.waiting += 1;
        totals.waiting += 1;
      } else {
        item.running += 1;
      }

      if (execution.status !== "completed") {
        const stepIndex = Math.max(
          0,
          Math.min(Number(execution.currentStepIndex || 0), item.dropOff.length - 1)
        );

        if (item.dropOff[stepIndex]) {
          item.dropOff[stepIndex].count += 1;
        }
      }
    }

    for (const item of Object.values(analyticsByFlow)) {
      item.completionRate = item.entered
        ? Math.round((item.completed / item.entered) * 100)
        : 0;
      item.handoffRate = item.entered
        ? Math.round((item.handoff / item.entered) * 100)
        : 0;
      item.dropOff = item.dropOff.filter((step) => step.count > 0);
    }

    return res.json({ totals, analyticsByFlow });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load flow analytics" });
  }
};

const matchesText = ({ keyword = "", matchMode = "contains", text = "" }) => {
  const needle = String(keyword || "").trim().toLowerCase();
  const body = String(text || "").trim().toLowerCase();

  if (!needle || !body) return false;
  if (matchMode === "exact") return body === needle;

  return body.includes(needle);
};

exports.simulateFlow = async (req, res) => {
  try {
    const { flowId, message = "", replies = [] } = req.body;
    const flow = await MessageFlow.findOne({
      _id: flowId,
      userId: req.user._id,
    });

    if (!flow) {
      return res.status(404).json({ message: "Message flow not found" });
    }

    const events = [];
    let index = 0;
    let latestReply = "";
    let replyIndex = 0;
    let guard = 0;

    while (index < flow.steps.length && guard < 100) {
      guard += 1;
      const step = flow.steps[index];

      events.push({
        stepNumber: index + 1,
        type: step.type,
        label: step.label || step.message || step.tag || step.conditionKeyword || step.type,
      });

      if (step.type === "await_reply") {
        latestReply = replies[replyIndex] || "";
        replyIndex += 1;

        if (!latestReply && step.noReplyJumpToStep) {
          index = Number(step.noReplyJumpToStep) - 1;
          events.push({
            stepNumber: index + 1,
            type: "no_reply",
            label: "No reply path selected",
          });
          continue;
        }
      }

      if (step.type === "condition") {
        const matched = matchesText({
          keyword: step.conditionKeyword,
          matchMode: step.conditionMatchMode,
          text: latestReply || message,
        });
        const targetIndex = Number(step.jumpToStep || 0) - 1;

        events[events.length - 1].matched = matched;

        if (matched && targetIndex >= 0 && targetIndex < flow.steps.length) {
          index = targetIndex;
          continue;
        }
      }

      if (step.type === "handoff") {
        break;
      }

      index += 1;
    }

    return res.json({
      flow: {
        _id: flow._id,
        name: flow.name,
      },
      events,
      completed: index >= flow.steps.length,
      stoppedByGuard: guard >= 100,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to simulate flow" });
  }
};
