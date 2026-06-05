import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaClone,
  FaExclamationTriangle,
  FaFileAlt,
  FaFilter,
  FaLanguage,
  FaRedo,
  FaSyncAlt,
} from "react-icons/fa";
import API from "../services/api";

function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState("");

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");

  const [buttons, setButtons] = useState([
    { type: "quick_reply", text: "Interested", value: "Interested" },
  ]);

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

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/template/list");
      setTemplates(safeArray(res?.data?.templates || res?.data || []));
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const syncMetaStatuses = async () => {
    try {
      setSyncing(true);
      const res = await API.get("/template/sync-meta");
      setTemplates(safeArray(res?.data?.templates || []));
      showNotice("success", res?.data?.message || "Meta status synced");
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const resetForm = () => {
    setEditingId("");
    setName("");
    setContent("");
    setCategory("MARKETING");
    setLanguage("en_US");
    setButtons([
      { type: "quick_reply", text: "Interested", value: "Interested" },
    ]);
  };

  const sanitizeTemplateName = (value = "") => {
    return value
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 512);
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

  const insertVariable = (variable) => {
    setContent((prev) => `${prev}${variable}`);
  };

  const validateMetaPlaceholders = (text = "") => {
    const wrongNamed = /\{[a-zA-Z_]+\}/.test(text);
    if (wrongNamed) {
      return "Use Meta variables like {{1}}, {{2}} — not {name} or {phone}";
    }

    const variables = text.match(/\{\{\d+\}\}/g) || [];
    const numbers = variables.map((item) => Number(item.replace(/\D/g, "")));
    const unique = [...new Set(numbers)].sort((a, b) => a - b);

    for (let i = 0; i < unique.length; i += 1) {
      if (unique[i] !== i + 1) {
        return "Meta variables must be sequential: {{1}}, {{2}}, {{3}}.";
      }
    }

    return "";
  };

  const validateForm = () => {
    if (!name.trim()) {
      showNotice("error", "Please enter template name");
      return false;
    }

    if (!content.trim()) {
      showNotice("error", "Please enter template content");
      return false;
    }

    const placeholderError = validateMetaPlaceholders(content);
    if (placeholderError) {
      showNotice("error", placeholderError);
      return false;
    }

    for (const btn of buttons) {
      if (!btn.text?.trim()) {
        showNotice("error", "Button text is required");
        return false;
      }

      if (!btn.value?.trim()) {
        showNotice("error", "Button value is required");
        return false;
      }

      if (btn.type === "url" && !/^https:\/\/.+/i.test(btn.value.trim())) {
        showNotice("error", "URL buttons must start with https://");
        return false;
      }

      if (btn.type === "call" && !/^\+\d{8,15}$/.test(btn.value.trim())) {
        showNotice("error", "Call button phone must be in format +919999999999");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        name: sanitizeTemplateName(name.trim()),
        content: content.trim(),
        category,
        language,
        buttons,
      };

      if (editingId) {
        await API.put(`/template/update/${editingId}`, payload);
        showNotice("success", "Template updated successfully");
      } else {
        const res = await API.post("/template/add", payload);
        showNotice(
          "success",
          res?.data?.message || "Template submitted to Meta successfully"
        );
      }

      resetForm();
      await loadTemplates();
    } catch (error) {
      const metaError = error?.response?.data?.metaError;
      const metaHint = metaError?.code
        ? ` (code: ${metaError.code}${metaError.subcode ? `, subcode: ${metaError.subcode}` : ""})`
        : "";

      showNotice(
        "error",
        `${error?.response?.data?.message || "Template save failed"}${metaHint}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template) => {
    setEditingId(template._id || template.id || "");
    setName(template.name || "");
    setContent(template.content || "");
    setCategory(template.category || "MARKETING");
    setLanguage(template.language || "en_US");
    setButtons(
      Array.isArray(template.buttons) && template.buttons.length
        ? template.buttons
        : [{ type: "quick_reply", text: "Interested", value: "Interested" }]
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this template?");
    if (!ok) return;

    try {
      setDeletingId(id);
      await API.delete(`/template/delete/${id}`);
      showNotice("success", "Template deleted successfully");

      if (editingId === id) {
        resetForm();
      }

      await loadTemplates();
    } catch (error) {
      showNotice(
        "error",
        error?.response?.data?.message || "Failed to delete template"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((item) => {
      const q = search.toLowerCase();
      const statusOk = statusFilter === "all" || item?.metaStatus === statusFilter;
      const categoryOk = categoryFilter === "all" || item?.category === categoryFilter;

      return statusOk && categoryOk && (
        (item?.name || "").toLowerCase().includes(q) ||
        (item?.content || "").toLowerCase().includes(q) ||
        (item?.category || "").toLowerCase().includes(q) ||
        (item?.metaStatus || "").toLowerCase().includes(q)
      );
    });
  }, [templates, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: templates.length,
      approved: templates.filter((t) => t.metaStatus === "APPROVED").length,
      pending: templates.filter((t) =>
        ["PENDING", "PENDING_SUBMISSION", "IN_REVIEW"].includes(t.metaStatus)
      ).length,
      rejected: templates.filter((t) =>
        ["REJECTED", "SUBMISSION_FAILED"].includes(t.metaStatus)
      ).length,
    };
  }, [templates]);

  const previewButtons = useMemo(() => {
    return buttons.filter((btn) => btn.text?.trim());
  }, [buttons]);

  const variables = useMemo(() => {
    return content.match(/\{\{\d+\}\}/g) || [];
  }, [content]);

  const validationItems = useMemo(() => {
    return [
      { label: "Template name", ok: Boolean(name.trim()) },
      { label: "Content", ok: Boolean(content.trim()) },
      { label: "Meta variables valid", ok: !validateMetaPlaceholders(content) },
      { label: "Buttons within limit", ok: buttons.length <= 3 },
      {
        label: "Button values valid",
        ok: buttons.every((btn) => {
          if (!btn.text?.trim() || !btn.value?.trim()) return false;
          if (btn.type === "url") return /^https:\/\/.+/i.test(btn.value.trim());
          if (btn.type === "call") return /^\+\d{8,15}$/.test(btn.value.trim());
          return true;
        }),
      },
    ];
  }, [buttons, content, name]);

  const readinessScore = useMemo(() => {
    const passed = validationItems.filter((item) => item.ok).length;
    return Math.round((passed / validationItems.length) * 100);
  }, [validationItems]);

  const approvalRate = useMemo(() => {
    if (!stats.total) return 0;
    return Math.round((stats.approved / stats.total) * 100);
  }, [stats]);

  const cloneTemplate = (template) => {
    setEditingId("");
    setName(`${template.name || "template"}_copy`);
    setContent(template.content || "");
    setCategory(template.category || "MARKETING");
    setLanguage(template.language || "en_US");
    setButtons(
      Array.isArray(template.buttons) && template.buttons.length
        ? template.buttons
        : [{ type: "quick_reply", text: "Interested", value: "Interested" }]
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
    showNotice("success", "Template cloned into editor");
  };

  const getStatusStyle = (status) => {
    if (status === "APPROVED") {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (status === "REJECTED" || status === "SUBMISSION_FAILED") {
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>Template Manager</h1>
          <p style={styles.subtitle}>
            Create WhatsApp templates, submit to Meta, and track approval status.
          </p>
        </div>

        <div style={styles.topActions}>
          <button style={styles.refreshBtn} onClick={loadTemplates}>
            <FaRedo />
            Refresh
          </button>
          <button
            style={styles.primaryBtn}
            onClick={syncMetaStatuses}
            disabled={syncing}
          >
            <FaSyncAlt />
            {syncing ? "Syncing..." : "Sync Meta Status"}
          </button>
        </div>
      </div>

      {notice.text ? (
        <div
          style={{
            ...styles.notice,
            ...(notice.type === "success"
              ? styles.noticeSuccess
              : styles.noticeError),
          }}
        >
          {notice.text}
        </div>
      ) : null}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaFileAlt /></div>
          <p style={styles.statLabel}>Total Templates</p>
          <h3 style={styles.statValue}>{stats.total}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaCheckCircle /></div>
          <p style={styles.statLabel}>Approved</p>
          <h3 style={styles.statValue}>{stats.approved}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaSyncAlt /></div>
          <p style={styles.statLabel}>Pending</p>
          <h3 style={styles.statValue}>{stats.pending}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIconDanger}><FaExclamationTriangle /></div>
          <p style={styles.statLabel}>Rejected</p>
          <h3 style={styles.statValue}>{stats.rejected}</h3>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaLanguage /></div>
          <p style={styles.statLabel}>Approval Rate</p>
          <h3 style={styles.statValue}>{approvalRate}%</h3>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.rowBetween}>
            <h3 style={styles.cardTitle}>
              {editingId ? "Update Template" : "Create Template"}
            </h3>

            {editingId ? (
              <button style={styles.lightBtn} onClick={resetForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Template Name</label>
            <input
              style={styles.input}
              placeholder="Eg. navratri_offer"
              value={name}
              onChange={(e) => setName(sanitizeTemplateName(e.target.value))}
            />
            <p style={styles.helperText}>
              Use lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Template Category</label>
            <select
              style={styles.input}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Language</label>
            <select
              style={styles.input}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en_US">English (US)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Template Content</label>
            <textarea
              style={styles.textarea}
              placeholder="Hello {{1}}, Navratri offer is live. Reply now to know more."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
            <p style={styles.helperText}>
              Use Meta variables like {"{{1}}"}, {"{{2}}"} — not {"{name}"}.
            </p>
          </div>

          <div style={styles.quickInsertWrap}>
            <span style={styles.quickInsertLabel}>Quick Insert:</span>
            <button
              type="button"
              style={styles.quickInsertBtn}
              onClick={() => insertVariable("{{1}}")}
            >
              {"{{1}}"}
            </button>
            <button
              type="button"
              style={styles.quickInsertBtn}
              onClick={() => insertVariable("{{2}}")}
            >
              {"{{2}}"}
            </button>
            <button
              type="button"
              style={styles.quickInsertBtn}
              onClick={() => insertVariable("{{3}}")}
            >
              {"{{3}}"}
            </button>
          </div>

          <div style={styles.cardSub}>
            <div style={styles.rowBetween}>
              <h4 style={styles.subTitle}>Template Buttons</h4>
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

          <div style={styles.actionRow}>
            <button type="button" style={styles.lightBtn} onClick={resetForm}>
              Reset
            </button>

            <button
              type="button"
              style={styles.primaryBtn}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? editingId
                  ? "Updating..."
                  : "Submitting..."
                : editingId
                ? "Update Template"
                : "Submit to Meta"}
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Live Preview</h3>

          <div style={styles.readinessBox}>
            <div style={styles.rowBetween}>
              <h4 style={styles.subTitle}>Meta Readiness</h4>
              <strong>{readinessScore}%</strong>
            </div>
            <div style={styles.progressBarBg}>
              <div style={{ ...styles.progressBarFill, width: `${readinessScore}%` }} />
            </div>
            <div style={styles.checkList}>
              {validationItems.map((item) => (
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
              {content || "Your template preview will appear here..."}
            </div>

            {previewButtons.length > 0 ? (
              <div style={styles.previewButtons}>
                {previewButtons.map((btn, index) => (
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
              <li>Template name me spaces mat use karo.</li>
              <li>Body me only {"{{1}}"}, {"{{2}}"} jaisi variables use karo.</li>
              <li>Approved templates hi campaign me send hone chahiye.</li>
              <li>Marketing templates me offer/promotional content rakho.</li>
            </ul>
          </div>

          <div style={styles.tipBox}>
            <h4 style={styles.subTitle}>Variable Samples</h4>
            {variables.length ? (
              variables.map((variable, index) => (
                <div key={`${variable}-${index}`} style={styles.sampleRow}>
                  <span>{variable}</span>
                  <strong>{index === 0 ? "Customer" : index === 1 ? "Offer" : `Sample ${index + 1}`}</strong>
                </div>
              ))
            ) : (
              <p style={styles.muted}>No variables used</p>
            )}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.rowBetween}>
          <h3 style={styles.cardTitle}>Saved Templates</h3>

          <input
            style={styles.searchInput}
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={styles.searchInput}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="PENDING_SUBMISSION">Pending submission</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUBMISSION_FAILED">Submission failed</option>
          </select>
          <select
            style={styles.searchInput}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>

        {loading ? (
          <div style={styles.emptyBox}>Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div style={styles.emptyBox}>No templates found</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Quality</th>
                  <th style={styles.th}>Content</th>
                  <th style={styles.th}>Buttons</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredTemplates.map((item, index) => (
                  <tr key={item._id || item.id || index}>
                    <td style={styles.td}>{item.name || "-"}</td>
                    <td style={styles.td}>{item.category || "-"}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...getStatusStyle(item.metaStatus || "DRAFT"),
                          border: "none",
                        }}
                      >
                        {item.metaStatus || "DRAFT"}
                      </span>
                    </td>
                    <td style={styles.td}>{item.metaQuality || "-"}</td>
                    <td style={styles.td}>
                      <div style={styles.contentCell}>{item.content || "-"}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.badgeWrap}>
                        {Array.isArray(item.buttons) && item.buttons.length ? (
                          item.buttons.map((btn, i) => (
                            <span key={i} style={styles.badge}>
                              {btn.text || btn.type}
                            </span>
                          ))
                        ) : (
                          <span style={styles.noButtonText}>No buttons</span>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionBtnsWrap}>
                        <button
                          type="button"
                          style={styles.editBtn}
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          style={styles.editBtn}
                          onClick={() => cloneTemplate(item)}
                        >
                          <FaClone /> Clone
                        </button>

                        <button
                          type="button"
                          style={styles.deleteBtn}
                          onClick={() => handleDelete(item._id || item.id)}
                          disabled={deletingId === (item._id || item.id)}
                        >
                          {deletingId === (item._id || item.id)
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },

  topActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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

  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "18px",
    alignItems: "start",
    marginBottom: "18px",
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

  helperText: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#64748b",
  },

  quickInsertWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "6px",
  },

  quickInsertLabel: {
    fontSize: "13px",
    color: "#64748b",
    fontWeight: "600",
  },

  quickInsertBtn: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "8px 12px",
    borderRadius: "999px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "12px",
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
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
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

  sampleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    padding: "9px 0",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
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
    minWidth: "1100px",
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
    verticalAlign: "top",
  },

  contentCell: {
    maxWidth: "320px",
    whiteSpace: "pre-wrap",
    lineHeight: "1.5",
    color: "#334155",
  },

  badgeWrap: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },

  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "700",
    border: "1px solid #bfdbfe",
  },

  noButtonText: {
    color: "#64748b",
    fontSize: "13px",
  },

  actionBtnsWrap: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  editBtn: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "700",
  },

  deleteBtn: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "700",
  },

  emptyBox: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
  },
};

export default Templates;
