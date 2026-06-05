import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaEdit,
  FaGripVertical,
  FaHandPaper,
  FaPause,
  FaPlay,
  FaPlus,
  FaProjectDiagram,
  FaSave,
  FaStickyNote,
  FaTrash,
  FaClock,
  FaCommentDots,
  FaCodeBranch,
  FaTag,
} from "react-icons/fa";
import API from "../services/api";

const emptyStep = () => ({
  type: "send_message",
  message: "Hi {name}, thanks for your message. How can we help?",
  delayMinutes: 0,
  label: "",
});

const defaultForm = {
  name: "Welcome Flow",
  triggerKeyword: "hi",
  matchMode: "contains",
  status: "active",
  triggerSource: "all",
  campaignId: "",
  steps: [emptyStep()],
};

const stepTypes = [
  { type: "send_message", label: "Message", icon: <FaCommentDots /> },
  { type: "send_template", label: "Template", icon: <FaCommentDots /> },
  { type: "wait", label: "Wait", icon: <FaClock /> },
  { type: "await_reply", label: "Wait Reply", icon: <FaCommentDots /> },
  { type: "condition", label: "Branch", icon: <FaCodeBranch /> },
  { type: "tag_contact", label: "Tag", icon: <FaTag /> },
  { type: "add_to_audience", label: "Audience", icon: <FaTag /> },
  { type: "note", label: "Note", icon: <FaStickyNote /> },
  { type: "handoff", label: "Handoff", icon: <FaHandPaper /> },
];

function MessageFlows() {
  const [flows, setFlows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [analytics, setAnalytics] = useState({ totals: {}, analyticsByFlow: {} });
  const [templates, setTemplates] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [simulator, setSimulator] = useState({ message: "hi", replies: "demo", result: null });
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice({ type: "", text: "" }), 3500);
  };

  const safeArray = (value) => (Array.isArray(value) ? value : []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [flowsRes, executionsRes, analyticsRes, templatesRes, audiencesRes, campaignsRes] =
        await Promise.all([
        API.get("/message-flows"),
        API.get("/message-flows/executions/list"),
        API.get("/message-flows/analytics/summary"),
        API.get("/template/list"),
        API.get("/audience/list"),
        API.get("/campaign/history"),
      ]);

      setFlows(safeArray(flowsRes.data?.flows));
      setExecutions(safeArray(executionsRes.data?.executions));
      setTemplates(safeArray(templatesRes.data?.templates || templatesRes.data));
      setAudiences(safeArray(audiencesRes.data?.audiences).filter((item) => item._id !== "all"));
      setCampaigns(safeArray(campaignsRes.data?.campaigns));
      setAnalytics({
        totals: analyticsRes.data?.totals || {},
        analyticsByFlow: analyticsRes.data?.analyticsByFlow || {},
      });
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to load message flows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const totals = analytics.totals || {};

    return {
      total: flows.length,
      active: flows.filter((flow) => flow.status === "active").length,
      entered: totals.entered || 0,
      completed: totals.completed || 0,
      handoff: totals.handoff || 0,
    };
  }, [analytics.totals, flows]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateStep = (index, field, value) => {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
  };

  const createStep = (type = "send_message") => {
    const step = emptyStep();
    step.type = type;

    if (type === "wait") {
      step.message = "";
      step.delayMinutes = 15;
    }

    if (type === "send_template") {
      step.message = "";
      step.templateId = templates[0]?._id || "";
    }

    if (type === "await_reply") {
      step.message = "";
      step.label = "Wait for customer reply";
      step.noReplyDelayMinutes = 0;
      step.noReplyJumpToStep = 0;
    }

    if (type === "note") {
      step.message = "";
      step.label = "Mark lead as interested";
    }

    if (type === "tag_contact") {
      step.message = "";
      step.tag = "Interested";
      step.label = "";
    }

    if (type === "add_to_audience") {
      step.message = "";
      step.audienceId = audiences[0]?._id || "";
    }

    if (type === "condition") {
      step.message = "";
      step.conditionKeyword = "price";
      step.conditionMatchMode = "contains";
      step.jumpToStep = 1;
    }

    if (type === "handoff") {
      step.message = "";
      step.label = "Move to inbox for agent follow-up";
    }

    return step;
  };

  const insertStep = (type = "send_message", index = form.steps.length) => {
    const step = createStep(type);
    setForm((prev) => {
      const steps = [...prev.steps];
      steps.splice(index, 0, step);
      return { ...prev, steps };
    });
  };

  const addStep = (type = "send_message") => {
    insertStep(type);
  };

  const removeStep = (index) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  };

  const moveStep = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    setForm((prev) => {
      const steps = [...prev.steps];
      const [moved] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, moved);
      return { ...prev, steps };
    });
  };

  const handlePaletteDragStart = (event, type) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-flow-step-type", type);
  };

  const handleStepDragStart = (event, index) => {
    setDraggingIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-flow-step-index", String(index));
  };

  const handleDropAt = (event, index) => {
    event.preventDefault();
    event.stopPropagation();
    const type = event.dataTransfer.getData("application/x-flow-step-type");
    const fromIndex = Number(event.dataTransfer.getData("application/x-flow-step-index"));

    if (type) {
      insertStep(type, index);
    } else if (!Number.isNaN(fromIndex)) {
      moveStep(fromIndex, index);
    }

    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDropToEnd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const type = event.dataTransfer.getData("application/x-flow-step-type");
    const fromIndex = Number(event.dataTransfer.getData("application/x-flow-step-index"));

    if (type) {
      insertStep(type);
    } else if (!Number.isNaN(fromIndex)) {
      moveStep(fromIndex, form.steps.length - 1);
    }

    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const resetForm = () => {
    setEditingId("");
    setForm(defaultForm);
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      showNotice("error", "Flow name is required");
      return false;
    }

    if (!form.triggerKeyword.trim()) {
      showNotice("error", "Trigger keyword is required");
      return false;
    }

    if (!form.steps.length) {
      showNotice("error", "Add at least one step");
      return false;
    }

    for (const step of form.steps) {
      if (step.type === "send_message" && !step.message.trim()) {
        showNotice("error", "Message step cannot be empty");
        return false;
      }

      if (step.type === "condition" && !step.conditionKeyword?.trim()) {
        showNotice("error", "Branch keyword is required");
        return false;
      }

      if (step.type === "tag_contact" && !step.tag?.trim()) {
        showNotice("error", "Contact tag is required");
        return false;
      }

      if (step.type === "send_template" && !step.templateId) {
        showNotice("error", "Template step needs a template");
        return false;
      }

      if (step.type === "add_to_audience" && !step.audienceId) {
        showNotice("error", "Audience step needs an audience");
        return false;
      }
    }

    return true;
  };

  const saveFlow = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = {
        ...form,
        steps: form.steps.map((step) => ({
          ...step,
          delayMinutes: Number(step.delayMinutes || 0),
          noReplyDelayMinutes: Number(step.noReplyDelayMinutes || 0),
          noReplyJumpToStep: Number(step.noReplyJumpToStep || 0),
        })),
      };

      if (editingId) {
        await API.put(`/message-flows/${editingId}`, payload);
        showNotice("success", "Message flow updated");
      } else {
        await API.post("/message-flows", payload);
        showNotice("success", "Message flow created");
      }

      resetForm();
      await loadData();
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to save flow");
    } finally {
      setSaving(false);
    }
  };

  const editFlow = (flow) => {
    setEditingId(flow._id);
    setForm({
      name: flow.name || "",
      triggerKeyword: flow.triggerKeyword || "",
      matchMode: flow.matchMode || "contains",
      status: flow.status || "active",
      triggerSource: flow.triggerSource || "all",
      campaignId: flow.campaignId || "",
      steps: safeArray(flow.steps).length ? flow.steps : [emptyStep()],
    });
  };

  const runSimulator = async () => {
    if (!editingId) {
      showNotice("error", "Edit a saved flow first, then run simulator");
      return;
    }

    try {
      const res = await API.post("/message-flows/simulate", {
        flowId: editingId,
        message: simulator.message,
        replies: simulator.replies
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setSimulator((prev) => ({ ...prev, result: res.data }));
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Simulation failed");
    }
  };

  const deleteFlow = async (flowId) => {
    const ok = window.confirm("Delete this message flow?");
    if (!ok) return;

    try {
      await API.delete(`/message-flows/${flowId}`);
      showNotice("success", "Message flow deleted");
      if (editingId === flowId) resetForm();
      await loadData();
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to delete flow");
    }
  };

  const statusLabel = (status) => {
    if (status === "active") return "Active";
    if (status === "waiting") return "Waiting";
    if (status === "awaiting_reply") return "Awaiting Reply";
    if (status === "handoff") return "Handoff";
    if (status === "failed") return "Failed";
    if (status === "paused") return "Paused";
    return "Completed";
  };

  if (loading) {
    return <div style={styles.loading}>Loading message flows...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Message Flows</h1>
          <p style={styles.subtitle}>Build keyword based WhatsApp automation for inbound replies.</p>
        </div>
        <button style={styles.secondaryButton} onClick={resetForm}>
          <FaPlus />
          New Flow
        </button>
      </div>

      {notice.text ? (
        <div style={{ ...styles.notice, ...(notice.type === "success" ? styles.success : styles.error) }}>
          {notice.text}
        </div>
      ) : null}

      <div style={styles.statGrid}>
        <StatCard label="Total Flows" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Users Entered" value={stats.entered} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="Handoff" value={stats.handoff} />
      </div>

      <div style={styles.grid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>{editingId ? "Edit Flow" : "Create Flow"}</h2>
              <p style={styles.panelSub}>Use {"{name}"} and {"{phone}"} in messages.</p>
            </div>
            <FaProjectDiagram style={styles.panelIcon} />
          </div>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Flow Name
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </label>

            <label style={styles.label}>
              Trigger Keyword
              <input
                style={styles.input}
                value={form.triggerKeyword}
                onChange={(e) => updateField("triggerKeyword", e.target.value)}
                placeholder="hi, price, demo"
              />
            </label>

            <label style={styles.label}>
              Match
              <select
                style={styles.input}
                value={form.matchMode}
                onChange={(e) => updateField("matchMode", e.target.value)}
              >
                <option value="contains">Contains keyword</option>
                <option value="exact">Exact message</option>
              </select>
            </label>

            <label style={styles.label}>
              Status
              <select
                style={styles.input}
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>

            <label style={styles.label}>
              Trigger Source
              <select
                style={styles.input}
                value={form.triggerSource}
                onChange={(e) => updateField("triggerSource", e.target.value)}
              >
                <option value="all">Any inbound reply</option>
                <option value="campaign_reply">Campaign reply</option>
              </select>
            </label>

            {form.triggerSource === "campaign_reply" ? (
              <label style={styles.label}>
                Campaign
                <select
                  style={styles.input}
                  value={form.campaignId}
                  onChange={(e) => updateField("campaignId", e.target.value)}
                >
                  <option value="">Any campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign._id} value={campaign._id}>
                      {campaign.campaign_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div style={styles.stepsHeader}>
            <h3 style={styles.smallTitle}>Steps</h3>
          </div>

          <div style={styles.builderGrid}>
            <div style={styles.palette}>
              {stepTypes.map((item) => (
                <button
                  key={item.type}
                  style={styles.paletteItem}
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                  onClick={() => addStep(item.type)}
                >
                  <span style={styles.paletteIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div
              style={styles.flowCanvas}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropToEnd}
            >
              {form.steps.map((step, index) => (
                <div key={`${step.type}-${index}`} style={styles.stepShell}>
                  <div
                    style={{
                      ...styles.dropLine,
                      ...(dragOverIndex === index ? styles.dropLineActive : {}),
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDrop={(event) => handleDropAt(event, index)}
                  />

                  <div
                    style={{
                      ...styles.stepCard,
                      ...(draggingIndex === index ? styles.stepCardDragging : {}),
                    }}
                  >
                    <div style={styles.stepTop}>
                      <button
                        style={styles.dragHandle}
                        draggable
                        onDragStart={(event) => handleStepDragStart(event, index)}
                        onDragEnd={() => {
                          setDraggingIndex(null);
                          setDragOverIndex(null);
                        }}
                        aria-label="Move step"
                      >
                        <FaGripVertical />
                      </button>
                      <strong>Step {index + 1}</strong>
                      <select
                        style={styles.stepSelect}
                        value={step.type}
                        onChange={(e) => updateStep(index, "type", e.target.value)}
                      >
                        <option value="send_message">Send Message</option>
                        <option value="send_template">Send Template</option>
                        <option value="wait">Wait</option>
                        <option value="await_reply">Wait for Reply</option>
                        <option value="condition">Branch</option>
                        <option value="tag_contact">Tag Contact</option>
                        <option value="add_to_audience">Add to Audience</option>
                        <option value="note">Note / Tag</option>
                        <option value="handoff">Human Handoff</option>
                      </select>
                      <button style={styles.iconButton} onClick={() => removeStep(index)} aria-label="Remove step">
                        <FaTrash />
                      </button>
                    </div>

                    {step.type === "send_message" ? (
                      <textarea
                        style={styles.textarea}
                        value={step.message}
                        onChange={(e) => updateStep(index, "message", e.target.value)}
                        rows={4}
                      />
                    ) : null}

                    {step.type === "wait" ? (
                      <label style={styles.label}>
                        Delay Minutes
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          value={step.delayMinutes}
                          onChange={(e) => updateStep(index, "delayMinutes", e.target.value)}
                        />
                      </label>
                    ) : null}

                    {step.type === "send_template" ? (
                      <label style={styles.label}>
                        Approved Template
                        <select
                          style={styles.input}
                          value={step.templateId || ""}
                          onChange={(e) => updateStep(index, "templateId", e.target.value)}
                        >
                          <option value="">Select template</option>
                          {templates
                            .filter((template) => template.metaStatus === "APPROVED")
                            .map((template) => (
                              <option key={template._id} value={template._id}>
                                {template.name || template.metaTemplateName}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}

                    {step.type === "await_reply" ? (
                      <div style={styles.branchGrid}>
                        <label style={styles.label}>
                          Label
                          <input
                            style={styles.input}
                            value={step.label}
                            onChange={(e) => updateStep(index, "label", e.target.value)}
                            placeholder="Wait for customer reply"
                          />
                        </label>
                        <label style={styles.label}>
                          No Reply Minutes
                          <input
                            style={styles.input}
                            type="number"
                            min="0"
                            value={step.noReplyDelayMinutes || 0}
                            onChange={(e) => updateStep(index, "noReplyDelayMinutes", e.target.value)}
                          />
                        </label>
                        <label style={styles.label}>
                          No Reply Jump
                          <input
                            style={styles.input}
                            type="number"
                            min="0"
                            max={form.steps.length}
                            value={step.noReplyJumpToStep || 0}
                            onChange={(e) => updateStep(index, "noReplyJumpToStep", e.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}

                    {step.type === "condition" ? (
                      <div style={styles.branchGrid}>
                        <label style={styles.label}>
                          If Latest Reply
                          <input
                            style={styles.input}
                            value={step.conditionKeyword || ""}
                            onChange={(e) => updateStep(index, "conditionKeyword", e.target.value)}
                            placeholder="price, demo, yes"
                          />
                        </label>

                        <label style={styles.label}>
                          Match
                          <select
                            style={styles.input}
                            value={step.conditionMatchMode || "contains"}
                            onChange={(e) => updateStep(index, "conditionMatchMode", e.target.value)}
                          >
                            <option value="contains">Contains</option>
                            <option value="exact">Exact</option>
                          </select>
                        </label>

                        <label style={styles.label}>
                          Jump To Step
                          <input
                            style={styles.input}
                            type="number"
                            min="1"
                            max={form.steps.length}
                            value={step.jumpToStep || 1}
                            onChange={(e) => updateStep(index, "jumpToStep", e.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}

                    {step.type === "tag_contact" ? (
                      <label style={styles.label}>
                        Contact Tag
                        <input
                          style={styles.input}
                          value={step.tag || ""}
                          onChange={(e) => updateStep(index, "tag", e.target.value)}
                          placeholder="Interested, Demo Lead, Pricing Asked"
                        />
                      </label>
                    ) : null}

                    {step.type === "add_to_audience" ? (
                      <label style={styles.label}>
                        Audience
                        <select
                          style={styles.input}
                          value={step.audienceId || ""}
                          onChange={(e) => updateStep(index, "audienceId", e.target.value)}
                        >
                          <option value="">Select audience</option>
                          {audiences.map((audience) => (
                            <option key={audience._id} value={audience._id}>
                              {audience.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    {step.type === "note" || step.type === "handoff" ? (
                      <label style={styles.label}>
                        Label
                        <input
                          style={styles.input}
                          value={step.label}
                          onChange={(e) => updateStep(index, "label", e.target.value)}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              ))}

              <div
                style={{
                  ...styles.dropZone,
                  ...(dragOverIndex === form.steps.length ? styles.dropZoneActive : {}),
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverIndex(form.steps.length);
                }}
                onDrop={handleDropToEnd}
              >
                <FaPlus />
              </div>
            </div>
          </div>

          <NodeCanvas steps={form.steps} />

          <button style={styles.primaryButton} onClick={saveFlow} disabled={saving}>
            <FaSave />
            {saving ? "Saving..." : editingId ? "Update Flow" : "Save Flow"}
          </button>
        </section>

        <aside style={styles.sideStack}>
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Saved Flows</h2>
            <div style={styles.flowList}>
              {flows.length ? flows.map((flow) => (
                <div key={flow._id} style={styles.flowCard}>
                  <div style={styles.flowItem}>
                    <div>
                      <div style={styles.flowTitle}>{flow.name}</div>
                      <div style={styles.flowMeta}>
                        {flow.matchMode === "exact" ? "Exact" : "Contains"}: {flow.triggerKeyword}
                      </div>
                      <div style={styles.flowMeta}>{flow.steps?.length || 0} steps - {flow.runs || 0} runs</div>
                    </div>
                    <div style={styles.flowActions}>
                      <span style={{ ...styles.badge, ...(flow.status === "active" ? styles.badgeActive : styles.badgePaused) }}>
                        {flow.status === "active" ? <FaPlay /> : <FaPause />}
                        {statusLabel(flow.status)}
                      </span>
                      <button style={styles.iconButton} onClick={() => editFlow(flow)} aria-label="Edit flow">
                        <FaEdit />
                      </button>
                      <button style={styles.iconButtonDanger} onClick={() => deleteFlow(flow._id)} aria-label="Delete flow">
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  <FlowAnalytics analytics={analytics.analyticsByFlow?.[flow._id]} />
                </div>
              )) : (
                <div style={styles.emptyBox}>No flows yet</div>
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Recent Activity</h2>
            <div style={styles.activityList}>
              {executions.length ? executions.slice(0, 8).map((item) => (
                <div key={item._id} style={styles.activityItem}>
                  <div>
                    <strong>{item.flowId?.name || "Flow"}</strong>
                    <p>{item.phone} - {item.triggerMessage || "-"}</p>
                  </div>
                  <span style={styles.activityStatus}>{statusLabel(item.status)}</span>
                </div>
              )) : (
                <div style={styles.emptyBox}>No activity yet</div>
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Flow Test Simulator</h2>
            <div style={styles.simulatorBox}>
              <label style={styles.label}>
                Trigger Message
                <input
                  style={styles.input}
                  value={simulator.message}
                  onChange={(e) =>
                    setSimulator((prev) => ({ ...prev, message: e.target.value }))
                  }
                />
              </label>
              <label style={styles.label}>
                Replies
                <textarea
                  style={styles.textarea}
                  rows={3}
                  value={simulator.replies}
                  onChange={(e) =>
                    setSimulator((prev) => ({ ...prev, replies: e.target.value }))
                  }
                />
              </label>
              <button style={styles.secondaryButton} onClick={runSimulator}>
                Run Test
              </button>

              {simulator.result ? (
                <div style={styles.simulatorResult}>
                  {simulator.result.events?.map((event, index) => (
                    <div key={`${event.type}-${index}`} style={styles.simulatorEvent}>
                      <strong>Step {event.stepNumber}</strong>
                      <span>{event.type}</span>
                      <p>{event.label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NodeCanvas({ steps }) {
  const boxHeight = 74;
  const gap = 28;
  const height = steps.length * (boxHeight + gap) + 24;

  return (
    <div style={styles.nodeCanvas}>
      <svg style={styles.nodeSvg} width="100%" height={height}>
        {steps.slice(0, -1).map((_, index) => {
          const y1 = 18 + index * (boxHeight + gap) + boxHeight;
          const y2 = 18 + (index + 1) * (boxHeight + gap);
          return (
            <line
              key={`line-${index}`}
              x1="50%"
              y1={y1}
              x2="50%"
              y2={y2}
              stroke="#94a3b8"
              strokeWidth="2"
            />
          );
        })}
        {steps.map((step, index) => {
          if (step.type !== "condition" || !step.jumpToStep) return null;
          const fromY = 18 + index * (boxHeight + gap) + boxHeight / 2;
          const toY = 18 + (Number(step.jumpToStep) - 1) * (boxHeight + gap) + boxHeight / 2;
          return (
            <path
              key={`branch-${index}`}
              d={`M 330 ${fromY} C 430 ${fromY}, 430 ${toY}, 330 ${toY}`}
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          );
        })}
      </svg>
      <div style={styles.nodeStack}>
        {steps.map((step, index) => (
          <div key={`${step.type}-${index}`} style={styles.nodeBox}>
            <strong>Step {index + 1}</strong>
            <span>{step.type}</span>
            <p>{step.label || step.message || step.tag || step.conditionKeyword || "Configured step"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowAnalytics({ analytics }) {
  const item = analytics || {};
  const dropOff = Array.isArray(item.dropOff) ? item.dropOff : [];

  return (
    <div style={styles.analyticsBox}>
      <div style={styles.analyticsGrid}>
        <MiniMetric label="Entered" value={item.entered || 0} />
        <MiniMetric label="Completed" value={item.completed || 0} />
        <MiniMetric label="Handoff" value={item.handoff || 0} />
        <MiniMetric label="Failed" value={item.failed || 0} />
      </div>

      <div style={styles.rateRow}>
        <span>Complete {item.completionRate || 0}%</span>
        <span>Handoff {item.handoffRate || 0}%</span>
      </div>

      <div style={styles.dropOffList}>
        <strong>Step Drop-Off</strong>
        {dropOff.length ? (
          dropOff.slice(0, 4).map((step) => (
            <div key={`${step.stepNumber}-${step.type}`} style={styles.dropOffItem}>
              <span>Step {step.stepNumber}: {step.type}</span>
              <b>{step.count}</b>
            </div>
          ))
        ) : (
          <p style={styles.dropOffEmpty}>No drop-off yet</p>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div style={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Inter, Arial, sans-serif",
  },
  loading: {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    color: "#334155",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
  },
  notice: {
    padding: "12px 14px",
    borderRadius: "8px",
    marginBottom: "16px",
    fontWeight: 800,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
    display: "grid",
    gap: "8px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1.35fr) minmax(320px,0.85fr)",
    gap: "18px",
    alignItems: "start",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "18px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "18px",
  },
  panelSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  panelIcon: {
    color: "#16a34a",
    fontSize: "24px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "12px",
  },
  label: {
    display: "grid",
    gap: "7px",
    color: "#334155",
    fontWeight: 800,
    fontSize: "13px",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "11px 12px",
    fontSize: "14px",
    boxSizing: "border-box",
    color: "#0f172a",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "11px 12px",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
    color: "#0f172a",
  },
  stepsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "20px",
    marginBottom: "12px",
  },
  smallTitle: {
    margin: 0,
    fontSize: "16px",
  },
  stepActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  tinyButton: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: "8px",
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 800,
  },
  stepsList: {
    display: "grid",
    gap: "12px",
  },
  builderGrid: {
    display: "grid",
    gridTemplateColumns: "150px minmax(0,1fr)",
    gap: "14px",
    alignItems: "start",
  },
  palette: {
    display: "grid",
    gap: "10px",
    position: "sticky",
    top: "16px",
  },
  paletteItem: {
    minHeight: "46px",
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: "8px",
    padding: "10px",
    cursor: "grab",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    textAlign: "left",
  },
  paletteIcon: {
    width: "18px",
    display: "inline-flex",
    justifyContent: "center",
  },
  flowCanvas: {
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "12px",
    background: "#f8fafc",
    minHeight: "220px",
  },
  stepShell: {
    display: "grid",
    gap: "8px",
  },
  dropLine: {
    height: "10px",
    borderRadius: "8px",
    border: "1px solid transparent",
    transition: "all 0.15s ease",
  },
  dropLineActive: {
    height: "18px",
    border: "1px solid #22c55e",
    background: "#dcfce7",
  },
  stepCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "14px",
    background: "#f8fafc",
    display: "grid",
    gap: "12px",
    transition: "opacity 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
  },
  stepCardDragging: {
    opacity: 0.55,
    borderColor: "#22c55e",
    transform: "scale(0.995)",
  },
  stepTop: {
    display: "grid",
    gridTemplateColumns: "36px auto minmax(160px,1fr) auto",
    gap: "10px",
    alignItems: "center",
  },
  dragHandle: {
    width: "36px",
    height: "36px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#64748b",
    cursor: "grab",
  },
  stepSelect: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "9px",
    background: "#fff",
  },
  branchGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(180px,1fr) minmax(120px,0.6fr) minmax(110px,0.5fr)",
    gap: "10px",
  },
  dropZone: {
    height: "48px",
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    color: "#64748b",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "8px",
    transition: "all 0.15s ease",
  },
  dropZoneActive: {
    borderColor: "#22c55e",
    background: "#dcfce7",
    color: "#166534",
  },
  nodeCanvas: {
    position: "relative",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#ffffff",
    marginTop: "16px",
    padding: "18px",
    overflow: "auto",
  },
  nodeSvg: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    minWidth: "520px",
  },
  nodeStack: {
    position: "relative",
    display: "grid",
    gap: "28px",
    justifyContent: "center",
    minWidth: "520px",
  },
  nodeBox: {
    width: "260px",
    minHeight: "74px",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    background: "#f0fdf4",
    color: "#14532d",
    padding: "10px",
    display: "grid",
    gap: "4px",
    boxSizing: "border-box",
    zIndex: 1,
  },
  primaryButton: {
    width: "100%",
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    border: "none",
    borderRadius: "8px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "16px",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#0f172a",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  sideStack: {
    display: "grid",
    gap: "18px",
  },
  flowList: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  flowCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "12px",
    display: "grid",
    gap: "12px",
  },
  flowItem: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    gap: "12px",
    alignItems: "center",
  },
  flowTitle: {
    fontWeight: 900,
    marginBottom: "4px",
  },
  flowMeta: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  flowActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  analyticsBox: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: "12px",
    display: "grid",
    gap: "10px",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: "8px",
  },
  miniMetric: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px",
    display: "grid",
    gap: "4px",
  },
  rateRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 900,
  },
  dropOffList: {
    display: "grid",
    gap: "7px",
    color: "#334155",
    fontSize: "12px",
  },
  dropOffItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "8px",
    padding: "8px",
  },
  dropOffEmpty: {
    margin: 0,
    color: "#64748b",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "8px",
    padding: "7px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
  badgeActive: {
    background: "#dcfce7",
    color: "#166534",
  },
  badgePaused: {
    background: "#f1f5f9",
    color: "#475569",
  },
  iconButton: {
    width: "36px",
    height: "36px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
  },
  iconButtonDanger: {
    width: "36px",
    height: "36px",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
  },
  activityList: {
    display: "grid",
    gap: "10px",
    marginTop: "14px",
  },
  activityItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "10px",
  },
  activityStatus: {
    color: "#16a34a",
    fontWeight: 900,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "18px",
    color: "#64748b",
    textAlign: "center",
  },
  simulatorBox: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  simulatorResult: {
    display: "grid",
    gap: "8px",
  },
  simulatorEvent: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#f8fafc",
    padding: "10px",
  },
};

export default MessageFlows;
