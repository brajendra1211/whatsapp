import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaBullhorn,
  FaCheckCircle,
  FaClone,
  FaClock,
  FaExclamationTriangle,
  FaEye,
  FaPaperPlane,
  FaRedo,
  FaUsers,
} from "react-icons/fa";
import API from "../services/api";

function Campaigns() {
  const [activeTab, setActiveTab] = useState("compose");

  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [audienceId, setAudienceId] = useState("all");
  const [testNumber, setTestNumber] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [sendMode, setSendMode] = useState("now");
  const [confirmSend, setConfirmSend] = useState(false);

  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");

  const [buttons, setButtons] = useState([
    { type: "quick_reply", text: "Interested", value: "Interested" },
  ]);

  const [templates, setTemplates] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState({
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  });
  const [failedNumbers, setFailedNumbers] = useState([]);
  const [analytics, setAnalytics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");

  const [notice, setNotice] = useState({
    type: "",
    text: "",
  });

  const showNotice = (type, text) => {
    setNotice({ type, text });

    setTimeout(() => {
      setNotice({ type: "", text: "" });
    }, 3000);
  };

  const safeArray = (value) => (Array.isArray(value) ? value : []);

  const loadAllData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [
        templateRes,
        audienceRes,
        historyRes,
        deliveryRes,
        failedRes,
        analyticsRes,
      ] = await Promise.allSettled([
        API.get("/template/list"),
        API.get("/audience/list"),
        API.get("/campaign/history"),
        API.get("/campaign/delivery-status"),
        API.get("/campaign/failed-report"),
        API.get("/campaign/analytics"),
      ]);

      if (templateRes.status === "fulfilled") {
        setTemplates(
          safeArray(
            templateRes.value?.data?.templates || templateRes.value?.data || []
          )
        );
      }

      if (audienceRes.status === "fulfilled") {
        setAudiences(
          safeArray(
            audienceRes.value?.data?.audiences || audienceRes.value?.data || []
          )
        );
      }

      if (historyRes.status === "fulfilled") {
        setCampaignHistory(
          safeArray(
            historyRes.value?.data?.campaigns || historyRes.value?.data || []
          )
        );
      }

      if (deliveryRes.status === "fulfilled") {
        setDeliveryStatus(
          deliveryRes.value?.data?.summary || deliveryRes.value?.data || {
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            failed: 0,
          }
        );
      }

      if (failedRes.status === "fulfilled") {
        setFailedNumbers(
          safeArray(
            failedRes.value?.data?.failed || failedRes.value?.data || []
          )
        );
      }

      if (analyticsRes.status === "fulfilled") {
        setAnalytics(
          safeArray(
            analyticsRes.value?.data?.analytics || analyticsRes.value?.data || []
          )
        );
      }
    } catch {
      showNotice("error", "Failed to load campaign data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const savedDraft = localStorage.getItem("wa_campaign_draft");

    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setCampaignName(parsed.campaignName || "");
        setMessage(parsed.message || "");
        setTemplateId(parsed.templateId || "");
        setAudienceId(parsed.audienceId || "all");
        setScheduleAt(parsed.scheduleAt || "");
        setSendMode(parsed.sendMode || "now");
        setButtons(
          Array.isArray(parsed.buttons) && parsed.buttons.length
            ? parsed.buttons
            : [{ type: "quick_reply", text: "Interested", value: "Interested" }]
        );
      } catch (err) {
        console.error("Draft parse error:", err);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "wa_campaign_draft",
      JSON.stringify({
        campaignName,
        message,
        templateId,
        audienceId,
        scheduleAt,
        sendMode,
        buttons,
      })
    );
  }, [campaignName, message, templateId, audienceId, scheduleAt, sendMode, buttons]);

  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  const handleTemplateChange = (id) => {
    setTemplateId(id);

    const selected = templates.find(
      (t) => String(t._id || t.id) === String(id)
    );

    if (!selected) return;

    setCampaignName(selected.name || selected.template_name || "");
    setMessage(selected.content || selected.message || "");

    if (Array.isArray(selected.buttons) && selected.buttons.length) {
      setButtons(selected.buttons);
    }

    showNotice("success", "Template loaded from database");
  };

  const handleMediaChange = (file) => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }

    setMediaFile(file || null);

    if (!file) {
      setMediaPreview("");
      return;
    }

    if (file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      setMediaPreview(previewUrl);
    } else {
      setMediaPreview("");
    }
  };

  const addButton = () => {
    if (buttons.length >= 3) {
      showNotice("error", "Maximum 3 buttons allowed");
      return;
    }

    setButtons([
      ...buttons,
      { type: "quick_reply", text: "Reply", value: "Reply" },
    ]);
  };

  const updateButton = (index, field, value) => {
    const updated = [...buttons];
    updated[index][field] = value;
    setButtons(updated);
  };

  const removeButton = (index) => {
    const updated = buttons.filter((_, i) => i !== index);
    setButtons(updated);
  };

  const resetComposer = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }

    setCampaignName("");
    setMessage("");
    setTemplateId("");
    setAudienceId("all");
    setTestNumber("");
    setScheduleAt("");
    setSendMode("now");
    setConfirmSend(false);
    setMediaFile(null);
    setMediaPreview("");
    setButtons([{ type: "quick_reply", text: "Interested", value: "Interested" }]);

    localStorage.removeItem("wa_campaign_draft");
    showNotice("success", "Composer reset successfully");
  };

  const buildFormData = () => {
    const formData = new FormData();

    formData.append("campaign_name", campaignName);
    formData.append("message", message);
    formData.append("template_id", templateId);
    formData.append("audience_id", audienceId);
    formData.append("send_mode", sendMode);
    formData.append("buttons", JSON.stringify(buttons));

    if (scheduleAt) {
      formData.append("schedule_at", new Date(scheduleAt).toISOString());
    }

    if (mediaFile) {
      formData.append("media", mediaFile);
    }

    return formData;
  };

  const sendTestMessage = async () => {
    if (!testNumber.trim()) {
      showNotice("error", "Please enter test number");
      return;
    }

    if (!message.trim()) {
      showNotice("error", "Please enter message before sending test");
      return;
    }

    try {
      setSendingTest(true);

      const formData = buildFormData();
      formData.append("test_number", testNumber.trim());

      await API.post("/message/send-test", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showNotice("success", "Test message sent successfully");
    } catch (error) {
      showNotice(
        "error",
        error?.response?.data?.message || "Failed to send test message"
      );
    } finally {
      setSendingTest(false);
    }
  };

  const submitCampaign = async () => {
    if (!campaignName.trim()) {
      showNotice("error", "Please enter campaign name");
      return;
    }

    if (!message.trim()) {
      showNotice("error", "Please enter campaign message");
      return;
    }

    if (!confirmSend) {
      showNotice("error", "Please confirm before sending campaign");
      return;
    }

    if (sendMode === "schedule" && !scheduleAt) {
      showNotice("error", "Please select schedule date and time");
      return;
    }

    try {
      setSendingCampaign(true);

      const formData = buildFormData();

      const res = await API.post("/message/send-campaign", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showNotice(
        "success",
        res?.data?.message ||
          (sendMode === "schedule"
            ? "Campaign scheduled successfully"
            : "Campaign sent successfully")
      );

      setConfirmSend(false);
      await loadAllData(true);
    } catch (error) {
      showNotice(
        "error",
        error?.response?.data?.message || "Campaign action failed"
      );
    } finally {
      setSendingCampaign(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return campaignHistory.filter((item) => {
      const q = historySearch.toLowerCase();
      const statusMatch =
        historyStatus === "all" ||
        String(item?.status || "").toLowerCase() === historyStatus;

      return statusMatch && (
        (item?.campaign_name || item?.name || "").toLowerCase().includes(q) ||
        (item?.status || "").toLowerCase().includes(q)
      );
    });
  }, [campaignHistory, historySearch, historyStatus]);

  const chartMax = useMemo(() => {
    const values = analytics.map((a) => Number(a.total || a.sent || 0));
    return Math.max(...values, 1);
  }, [analytics]);

  const successRate = useMemo(() => {
    if (!deliveryStatus.sent) return 0;
    return Math.round((deliveryStatus.delivered / deliveryStatus.sent) * 100);
  }, [deliveryStatus]);

  const readRate = useMemo(() => {
    if (!deliveryStatus.delivered) return 0;
    return Math.round((deliveryStatus.read / deliveryStatus.delivered) * 100);
  }, [deliveryStatus]);

  const replyRate = useMemo(() => {
    if (!deliveryStatus.read) return 0;
    return Math.round((deliveryStatus.replied / deliveryStatus.read) * 100);
  }, [deliveryStatus]);

  const failedRate = useMemo(() => {
    if (!deliveryStatus.sent) return 0;
    return Math.round((deliveryStatus.failed / deliveryStatus.sent) * 100);
  }, [deliveryStatus]);

  const approvedTemplates = useMemo(() => {
    return templates.filter((template) => template.metaStatus === "APPROVED");
  }, [templates]);

  const selectedTemplate = useMemo(() => {
    return templates.find((template) => String(template._id || template.id) === String(templateId));
  }, [templateId, templates]);

  const selectedAudience = useMemo(() => {
    return audiences.find((audience) => String(audience._id || audience.id) === String(audienceId));
  }, [audienceId, audiences]);

  const estimatedRecipients = useMemo(() => {
    if (audienceId === "all") {
      const allAudience = audiences.find((audience) => audience._id === "all");
      return Number(allAudience?.total || 0);
    }

    return Number(selectedAudience?.total || 0);
  }, [audienceId, audiences, selectedAudience]);

  const scheduledCount = useMemo(() => {
    return campaignHistory.filter((item) => item.status === "scheduled").length;
  }, [campaignHistory]);

  const messageStats = useMemo(() => {
    const text = message || "";
    return {
      chars: text.length,
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      variables: (text.match(/\{name\}|\{phone\}|\{\{\d+\}\}/g) || []).length,
    };
  }, [message]);

  const readinessChecks = useMemo(() => {
    return [
      { label: "Campaign name", ok: Boolean(campaignName.trim()) },
      { label: "Message content", ok: Boolean(message.trim()) },
      { label: "Audience has recipients", ok: estimatedRecipients > 0 },
      {
        label: "Template approved",
        ok: !templateId || selectedTemplate?.metaStatus === "APPROVED",
      },
      {
        label: "Schedule selected",
        ok: sendMode !== "schedule" || Boolean(scheduleAt),
      },
      { label: "Confirmed", ok: confirmSend },
    ];
  }, [campaignName, confirmSend, estimatedRecipients, message, scheduleAt, selectedTemplate, sendMode, templateId]);

  const readinessScore = useMemo(() => {
    const passed = readinessChecks.filter((item) => item.ok).length;
    return Math.round((passed / readinessChecks.length) * 100);
  }, [readinessChecks]);

  const exportFailedCSV = () => {
    if (!failedNumbers.length) {
      showNotice("error", "No failed numbers available");
      return;
    }

    const csvRows = [
      ["Phone", "Reason", "Campaign", "Date"],
      ...failedNumbers.map((item) => [
        item.phone || "",
        item.reason || "",
        item.campaign_name || item.campaign || "",
        formatDate(item.createdAt || item.date || ""),
      ]),
    ];

    const csvContent = csvRows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "failed_numbers_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const duplicateCampaign = (item) => {
    setCampaignName(`${item.campaign_name || item.name || "Campaign"} Copy`);
    setMessage(item.message || "");
    setAudienceId(item.audience_id || "all");
    setTemplateId(item.template_id || "");
    setButtons(Array.isArray(item.buttons) && item.buttons.length ? item.buttons : buttons);
    setSendMode("now");
    setScheduleAt("");
    setConfirmSend(false);
    setActiveTab("compose");
    showNotice("success", "Campaign loaded into composer");
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();

    if (s === "completed" || s === "sent") {
      return { color: "#166534", background: "#dcfce7" };
    }
    if (s === "scheduled") {
      return { color: "#92400e", background: "#fef3c7" };
    }
    if (s === "running" || s === "processing") {
      return { color: "#1d4ed8", background: "#dbeafe" };
    }
    if (s === "failed") {
      return { color: "#991b1b", background: "#fee2e2" };
    }

    return { color: "#334155", background: "#e2e8f0" };
  };

  if (loading) {
    return <div style={styles.loading}>Loading campaign module...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>Campaign Manager</h1>
          <p style={styles.subtitle}>
            Send, schedule, track, and analyze WhatsApp bulk campaigns.
          </p>
        </div>

        <button
          style={styles.refreshBtn}
          onClick={() => loadAllData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {notice.text ? (
        <div
          style={{
            ...styles.notice,
            ...(notice.type === "success" ? styles.noticeSuccess : styles.noticeError),
          }}
        >
          {notice.text}
        </div>
      ) : null}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaPaperPlane /></div>
          <p style={styles.statLabel}>Sent</p>
          <h3 style={styles.statValue}>{deliveryStatus.sent || 0}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaCheckCircle /></div>
          <p style={styles.statLabel}>Delivered</p>
          <h3 style={styles.statValue}>{deliveryStatus.delivered || 0}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaEye /></div>
          <p style={styles.statLabel}>Read</p>
          <h3 style={styles.statValue}>{deliveryStatus.read || 0}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIconDanger}><FaExclamationTriangle /></div>
          <p style={styles.statLabel}>Failed</p>
          <h3 style={styles.statValue}>{deliveryStatus.failed || 0}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaBolt /></div>
          <p style={styles.statLabel}>Success Rate</p>
          <h3 style={styles.statValue}>{successRate}%</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaClock /></div>
          <p style={styles.statLabel}>Scheduled</p>
          <h3 style={styles.statValue}>{scheduledCount}</h3>
        </div>
      </div>

      <div style={styles.tabs}>
        {["compose", "history", "analytics", "reports"].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tabBtn,
              ...(activeTab === tab ? styles.activeTabBtn : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "compose" && "Compose"}
            {tab === "history" && "Campaign History"}
            {tab === "analytics" && "Analytics"}
            {tab === "reports" && "Reports"}
          </button>
        ))}
      </div>

      {activeTab === "compose" && (
        <div style={styles.grid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Compose Campaign</h3>

            <div style={styles.formGroup}>
              <label style={styles.label}>Campaign Name</label>
              <input
                style={styles.input}
                placeholder="Eg. Summer Offer Campaign"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            <div style={styles.twoCol}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Template from DB</label>
                <select
                  style={styles.select}
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">Select Template</option>
                  {approvedTemplates.map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.name || t.template_name} - approved
                    </option>
                  ))}
                </select>
                <p style={styles.helperText}>{approvedTemplates.length} approved templates available</p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Target Audience</label>
                <select
                  style={styles.select}
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                >
                  <option value="all">All Contacts</option>
                  {audiences.map((a) => (
                    <option key={a._id || a.id} value={a._id || a.id}>
                      {(a.name || a.segment_name || "Audience") +
                        (a.total ? ` (${a.total})` : "")}
                    </option>
                  ))}
                </select>
                <p style={styles.helperText}>
                  Estimated recipients: {estimatedRecipients || 0}
                </p>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Message</label>
              <textarea
                style={styles.textarea}
                placeholder="Write your WhatsApp campaign message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
              />
              <div style={styles.messageMetaRow}>
                <span>{messageStats.chars} chars</span>
                <span>{messageStats.words} words</span>
                <span>{messageStats.variables} variables</span>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Media / Image / PDF</label>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                style={styles.fileInput}
                onChange={(e) => handleMediaChange(e.target.files?.[0])}
              />
            </div>

            {mediaFile ? (
              <div style={styles.mediaBox}>
                <p style={styles.mediaText}>
                  <strong>Selected:</strong> {mediaFile.name}
                </p>

                {mediaPreview ? (
                  <img
                    src={mediaPreview}
                    alt="preview"
                    style={styles.imagePreview}
                  />
                ) : (
                  <div style={styles.pdfBox}>File attached successfully</div>
                )}
              </div>
            ) : null}

            <div style={styles.cardSub}>
              <div style={styles.rowBetween}>
                <h4 style={styles.subTitle}>Button Template Message</h4>
                <button type="button" style={styles.smallBtn} onClick={addButton}>
                  + Add Button
                </button>
              </div>

              {buttons.length === 0 ? (
                <p style={styles.muted}>No buttons added</p>
              ) : (
                buttons.map((btn, index) => (
                  <div key={index} style={styles.buttonRow}>
                    <select
                      style={styles.selectSmall}
                      value={btn.type}
                      onChange={(e) =>
                        updateButton(index, "type", e.target.value)
                      }
                    >
                      <option value="quick_reply">Quick Reply</option>
                      <option value="url">URL</option>
                      <option value="call">Call</option>
                    </select>

                    <input
                      style={styles.inputSmall}
                      placeholder="Button Text"
                      value={btn.text}
                      onChange={(e) =>
                        updateButton(index, "text", e.target.value)
                      }
                    />

                    <input
                      style={styles.inputSmall}
                      placeholder={
                        btn.type === "url"
                          ? "https://example.com"
                          : btn.type === "call"
                          ? "+91xxxxxxxxxx"
                          : "Reply payload"
                      }
                      value={btn.value}
                      onChange={(e) =>
                        updateButton(index, "value", e.target.value)
                      }
                    />

                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removeButton(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={styles.cardSub}>
              <h4 style={styles.subTitle}>Send Options</h4>

              <div style={styles.modeRow}>
                <label style={styles.radioWrap}>
                  <input
                    type="radio"
                    checked={sendMode === "now"}
                    onChange={() => setSendMode("now")}
                  />
                  Send Now
                </label>

                <label style={styles.radioWrap}>
                  <input
                    type="radio"
                    checked={sendMode === "schedule"}
                    onChange={() => setSendMode("schedule")}
                  />
                  Schedule Campaign
                </label>
              </div>

              {sendMode === "schedule" && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    style={styles.input}
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div style={styles.cardSub}>
              <h4 style={styles.subTitle}>Send Test Message</h4>
              <div style={styles.testRow}>
                <input
                  style={styles.input}
                  placeholder="Enter test WhatsApp number"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                />
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={sendTestMessage}
                  disabled={sendingTest}
                >
                  {sendingTest ? "Sending..." : "Send Test"}
                </button>
              </div>
            </div>

            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={confirmSend}
                onChange={(e) => setConfirmSend(e.target.checked)}
              />
              <span>I confirm this campaign is ready</span>
            </div>

            <div style={styles.actionRow}>
              <button type="button" style={styles.lightBtn} onClick={resetComposer}>
                Reset
              </button>

              <button
                type="button"
                style={styles.primaryBtn}
                onClick={submitCampaign}
                disabled={sendingCampaign}
              >
                {sendingCampaign
                  ? "Processing..."
                  : sendMode === "schedule"
                  ? "Schedule Campaign"
                  : "Send Campaign"}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Live Preview</h3>

            <div style={styles.readinessBox}>
              <div style={styles.rowBetween}>
                <h4 style={styles.subTitle}>Campaign Readiness</h4>
                <strong>{readinessScore}%</strong>
              </div>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${readinessScore}%` }} />
              </div>
              <div style={styles.checkList}>
                {readinessChecks.map((item) => (
                  <div key={item.label} style={styles.checkItem}>
                    {item.ok ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.previewPhone}>
              <div style={styles.previewHeader}>WhatsApp Preview</div>

              <div style={styles.previewBubble}>
                {message || "Your campaign preview will appear here..."}
              </div>

              {mediaFile ? (
                <div style={styles.previewMedia}>Attached: {mediaFile.name}</div>
              ) : null}

              {buttons.length > 0 ? (
                <div style={styles.previewButtons}>
                  {buttons.map((btn, index) => (
                    <div key={index} style={styles.previewBtnItem}>
                      {btn.text || "Button"}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={styles.tipBox}>
              <h4 style={styles.subTitle}>Tips</h4>
              <ul style={styles.tipList}>
                <li>Message short aur clear rakho.</li>
                <li>PDF, image, brochure media ke saath CTR better hota hai.</li>
                <li>Buttons se reply aur conversion improve hota hai.</li>
                <li>Schedule campaign peak business hours me bhejo.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div style={styles.card}>
          <div style={styles.rowBetween}>
            <h3 style={styles.cardTitle}>Campaign History</h3>
            <input
              style={styles.searchInput}
              placeholder="Search campaign..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
            <select
              style={styles.searchInput}
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Campaign</th>
                  <th style={styles.th}>Audience</th>
                  <th style={styles.th}>Sent</th>
                  <th style={styles.th}>Delivered</th>
                  <th style={styles.th}>Failed</th>
                  <th style={styles.th}>Engagement</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={styles.emptyCell}>
                      No campaign history found
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, index) => {
                    const badge = getStatusBadge(item.status);

                    return (
                      <tr key={item._id || item.id || index}>
                        <td style={styles.td}>
                          {item.campaign_name || item.name || "-"}
                        </td>
                        <td style={styles.td}>
                          {item.audience_name || item.audience || "All Contacts"}
                        </td>
                        <td style={styles.td}>{item.sent || item.total || 0}</td>
                        <td style={styles.td}>{item.delivered || 0}</td>
                        <td style={styles.td}>{item.failed || 0}</td>
                        <td style={styles.td}>
                          {item.read || 0} read / {item.replied || 0} replies
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              color: badge.color,
                              background: badge.background,
                            }}
                          >
                            {item.status || "Unknown"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {formatDate(item.createdAt || item.date)}
                        </td>
                        <td style={styles.td}>
                          <button style={styles.smallBtn} onClick={() => duplicateCampaign(item)}>
                            <FaClone /> Duplicate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div style={styles.analyticsGrid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Campaign Analytics Chart</h3>

            {analytics.length === 0 ? (
              <div style={styles.emptyBox}>No analytics data found</div>
            ) : (
              <div style={styles.chartWrap}>
                {analytics.map((item, index) => {
                  const value = Number(item.total || item.sent || 0);
                  const height = `${(value / chartMax) * 180}px`;

                  return (
                    <div key={index} style={styles.barItem}>
                      <div style={styles.barValue}>{value}</div>
                      <div style={{ ...styles.bar, height }} />
                      <div style={styles.barLabel}>
                        {item.label || item.date || `Day ${index + 1}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Delivery Status</h3>

            <div style={styles.deliveryList}>
              <div style={styles.deliveryRow}>
                <span>Sent</span>
                <strong>{deliveryStatus.sent || 0}</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Delivered</span>
                <strong>{deliveryStatus.delivered || 0}</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Read</span>
                <strong>{deliveryStatus.read || 0}</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Replied</span>
                <strong>{deliveryStatus.replied || 0}</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Failed</span>
                <strong>{deliveryStatus.failed || 0}</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Success Rate</span>
                <strong>{successRate}%</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Read Rate</span>
                <strong>{readRate}%</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Reply Rate</span>
                <strong>{replyRate}%</strong>
              </div>
              <div style={styles.deliveryRow}>
                <span>Failed Rate</span>
                <strong>{failedRate}%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reports" && (
        <div style={styles.card}>
          <div style={styles.rowBetween}>
            <h3 style={styles.cardTitle}>Failed Numbers Report</h3>
            <button type="button" style={styles.secondaryBtn} onClick={exportFailedCSV}>
              Export CSV
            </button>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Campaign</th>
                  <th style={styles.th}>Date</th>
                </tr>
              </thead>

              <tbody>
                {failedNumbers.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={styles.emptyCell}>
                      No failed numbers found
                    </td>
                  </tr>
                ) : (
                  failedNumbers.map((item, index) => (
                    <tr key={item._id || item.id || index}>
                      <td style={styles.td}>{item.phone || "-"}</td>
                      <td style={styles.td}>{item.reason || "-"}</td>
                      <td style={styles.td}>
                        {item.campaign_name || item.campaign || "-"}
                      </td>
                      <td style={styles.td}>
                        {formatDate(item.createdAt || item.date)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },

  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    color: "#334155",
    fontWeight: "600",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    color: "#0f172a",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },

  refreshBtn: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    padding: "10px 16px",
    borderRadius: "10px",
    fontWeight: "600",
    cursor: "pointer",
  },

  notice: {
    marginBottom: "18px",
    padding: "12px 16px",
    borderRadius: "10px",
    fontWeight: "600",
  },

  noticeSuccess: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  noticeError: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "18px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  statIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "10px",
  },

  statIconDanger: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    background: "#fee2e2",
    color: "#991b1b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "10px",
  },

  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
  },

  statValue: {
    margin: "8px 0 0",
    fontSize: "28px",
    color: "#0f172a",
  },

  tabs: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },

  tabBtn: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
  },

  activeTabBtn: {
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#fff",
    border: "none",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: "18px",
    alignItems: "start",
  },

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.9fr",
    gap: "18px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  cardTitle: {
    margin: "0 0 16px",
    fontSize: "18px",
    color: "#0f172a",
  },

  cardSub: {
    marginTop: "16px",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
  },

  subTitle: {
    margin: "0 0 12px",
    fontSize: "15px",
    color: "#0f172a",
  },

  formGroup: {
    marginBottom: "14px",
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },

  label: {
    display: "block",
    marginBottom: "8px",
    color: "#334155",
    fontWeight: "600",
    fontSize: "14px",
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  },

  helperText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },

  messageMetaRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
  },

  textarea: {
    width: "100%",
    minHeight: "180px",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    outline: "none",
    resize: "vertical",
    fontSize: "14px",
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "14px",
    background: "#fff",
  },

  fileInput: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    boxSizing: "border-box",
  },

  mediaBox: {
    marginTop: "10px",
    padding: "14px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#f8fafc",
  },

  mediaText: {
    margin: "0 0 10px",
    color: "#334155",
    fontSize: "14px",
  },

  imagePreview: {
    width: "100%",
    maxHeight: "220px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
  },

  pdfBox: {
    padding: "14px",
    borderRadius: "10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: "600",
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  smallBtn: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
  },

  readinessBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "16px",
  },

  progressBarBg: {
    height: "9px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "12px",
  },

  progressBarFill: {
    height: "100%",
    background: "#16a34a",
    borderRadius: "999px",
  },

  checkList: {
    display: "grid",
    gap: "8px",
  },

  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: "700",
  },

  buttonRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 1fr 100px",
    gap: "10px",
    marginBottom: "10px",
  },

  selectSmall: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#fff",
  },

  inputSmall: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    outline: "none",
    boxSizing: "border-box",
  },

  removeBtn: {
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
  },

  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },

  modeRow: {
    display: "flex",
    gap: "18px",
    flexWrap: "wrap",
  },

  radioWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#334155",
    fontWeight: "600",
  },

  testRow: {
    display: "grid",
    gridTemplateColumns: "1fr 180px",
    gap: "10px",
  },

  checkboxRow: {
    marginTop: "16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#334155",
    fontWeight: "600",
  },

  actionRow: {
    marginTop: "18px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },

  lightBtn: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    padding: "12px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
  },

  primaryBtn: {
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#fff",
    border: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
  },

  secondaryBtn: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "12px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
  },

  previewPhone: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    borderRadius: "18px",
    padding: "16px",
  },

  previewHeader: {
    color: "#166534",
    fontWeight: "700",
    marginBottom: "12px",
    fontSize: "13px",
  },

  previewBubble: {
    background: "#fff",
    padding: "14px",
    borderRadius: "14px",
    lineHeight: "1.6",
    color: "#0f172a",
    whiteSpace: "pre-wrap",
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
  },

  previewMedia: {
    marginTop: "10px",
    background: "#fff",
    borderRadius: "12px",
    padding: "10px 12px",
    color: "#334155",
    fontWeight: "600",
  },

  previewButtons: {
    marginTop: "12px",
    display: "grid",
    gap: "8px",
  },

  previewBtnItem: {
    background: "#fff",
    color: "#2563eb",
    textAlign: "center",
    padding: "10px 12px",
    borderRadius: "10px",
    fontWeight: "600",
    border: "1px solid #dbeafe",
  },

  tipBox: {
    marginTop: "18px",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
  },

  tipList: {
    margin: 0,
    paddingLeft: "18px",
    color: "#475569",
    lineHeight: "1.8",
    fontSize: "14px",
  },

  searchInput: {
    minWidth: "240px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    outline: "none",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "800px",
  },

  th: {
    textAlign: "left",
    padding: "14px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "13px",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontSize: "14px",
  },

  emptyCell: {
    textAlign: "center",
    padding: "30px 14px",
    color: "#64748b",
    fontSize: "14px",
  },

  statusBadge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
  },

  chartWrap: {
    height: "260px",
    display: "flex",
    alignItems: "flex-end",
    gap: "14px",
    paddingTop: "20px",
    overflowX: "auto",
  },

  barItem: {
    minWidth: "60px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
  },

  barValue: {
    fontSize: "12px",
    color: "#334155",
    fontWeight: "700",
  },

  bar: {
    width: "36px",
    minHeight: "10px",
    background: "linear-gradient(180deg,#2563eb,#7c3aed)",
    borderRadius: "10px 10px 0 0",
  },

  barLabel: {
    fontSize: "12px",
    color: "#64748b",
    textAlign: "center",
  },

  emptyBox: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
  },

  deliveryList: {
    display: "grid",
    gap: "12px",
  },

  deliveryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    color: "#334155",
    fontWeight: "600",
  },
};

export default Campaigns;
