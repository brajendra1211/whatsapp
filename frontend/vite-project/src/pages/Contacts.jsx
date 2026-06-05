import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaEdit,
  FaFilter,
  FaLayerGroup,
  FaPlus,
  FaSyncAlt,
  FaTag,
  FaTrash,
  FaUpload,
  FaUsers,
} from "react-icons/fa";
import API from "../services/api";

const pageSize = 10;

const splitTags = (value = "") =>
  value
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const leadStages = [
  { value: "new", label: "New Lead" },
  { value: "interested", label: "Interested" },
  { value: "site_visit", label: "Demo / Visit" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
];

const emptyForm = {
  name: "",
  phone: "",
  tags: "",
  leadStage: "new",
  leadSource: "",
  dealValue: "",
  requirementType: "",
  preference: "",
  reminderAt: "",
  reminderNote: "",
  profileNote: "",
};

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [tagFilter, setTagFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [audienceId, setAudienceId] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 3500);
  };

  const safeArray = (value) => (Array.isArray(value) ? value : []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [contactsRes, audiencesRes] = await Promise.all([
        API.get("/contact/list"),
        API.get("/audience/list"),
      ]);

      setContacts(safeArray(contactsRes.data));
      setAudiences(safeArray(audiencesRes.data?.audiences).filter((item) => item._id !== "all"));
    } catch {
      showMessage("error", "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allTags = useMemo(() => {
    return [...new Set(contacts.flatMap((contact) => safeArray(contact.tags)))].sort();
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    let data = [...contacts];
    const q = search.trim().toLowerCase();

    if (q) {
      data = data.filter((contact) => {
        const tags = safeArray(contact.tags).join(" ").toLowerCase();
        return (
          contact.name?.toLowerCase().includes(q) ||
          contact.phone?.includes(q) ||
          tags.includes(q)
        );
      });
    }

    if (tagFilter !== "all") {
      data = data.filter((contact) => safeArray(contact.tags).includes(tagFilter));
    }

    if (stageFilter !== "all") {
      data = data.filter((contact) => (contact.leadStage || "new") === stageFilter);
    }

    if (sortBy === "name-asc") data.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "name-desc") data.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === "oldest") data.reverse();

    return data;
  }, [contacts, search, sortBy, tagFilter, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, sortBy, tagFilter, stageFilter]);

  const resetForm = () => {
    setEditingId("");
    setForm(emptyForm);
  };

  const saveContact = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      showMessage("error", "Please enter name and phone");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        tags: splitTags(form.tags),
        leadStage: form.leadStage,
        leadSource: form.leadSource,
        dealValue: form.dealValue,
        requirementType: form.requirementType,
        preference: form.preference,
        reminderAt: form.reminderAt || null,
        reminderNote: form.reminderNote,
        profileNote: form.profileNote,
      };

      if (editingId) {
        await API.put(`/contact/update/${editingId}`, payload);
        showMessage("success", "Contact updated");
      } else {
        await API.post("/contact/add", payload);
        showMessage("success", "Contact added");
      }

      resetForm();
      await loadData();
    } catch (error) {
      showMessage("error", error?.response?.data?.message || "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const editContact = (contact) => {
    setEditingId(contact._id);
    setForm({
      name: contact.name || "",
      phone: contact.phone || "",
      tags: safeArray(contact.tags).join(", "),
      leadStage: contact.leadStage || "new",
      leadSource: contact.leadSource || "",
      dealValue: contact.dealValue || contact.budget || "",
      requirementType: contact.requirementType || contact.propertyType || "",
      preference: contact.preference || contact.preferredLocation || "",
      reminderAt: contact.reminderAt ? new Date(new Date(contact.reminderAt).getTime() - new Date(contact.reminderAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      reminderNote: contact.reminderNote || "",
      profileNote: contact.profileNote || "",
    });
  };

  const deleteContact = async (id) => {
    const confirmDelete = window.confirm("Delete this contact?");
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      await API.delete(`/contact/delete/${id}`);
      showMessage("success", "Contact deleted");
      await loadData();
    } catch {
      showMessage("error", "Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  };

  const importCSV = async () => {
    if (!file) {
      showMessage("error", "Please select a CSV file");
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await API.post("/contact/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFile(null);
      const input = document.getElementById("csvFileInput");
      if (input) input.value = "";
      showMessage(
        "success",
        `Imported ${res.data?.inserted || 0}, updated ${res.data?.updated || 0}, skipped ${res.data?.skipped || 0}`
      );
      await loadData();
    } catch (error) {
      showMessage("error", error?.response?.data?.message || "CSV import failed");
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedContacts.map((contact) => contact._id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      allSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : [...new Set([...prev, ...pageIds])]
    );
  };

  const applyBulkTags = async () => {
    const tags = splitTags(bulkTags);
    if (!selectedIds.length || !tags.length) {
      showMessage("error", "Select contacts and enter tags");
      return;
    }

    try {
      await API.post("/contact/bulk-tag", { contactIds: selectedIds, tags });
      showMessage("success", "Tags applied");
      setBulkTags("");
      setSelectedIds([]);
      await loadData();
    } catch (error) {
      showMessage("error", error?.response?.data?.message || "Failed to apply tags");
    }
  };

  const addToAudience = async () => {
    if (!selectedIds.length || !audienceId) {
      showMessage("error", "Select contacts and audience");
      return;
    }

    try {
      await API.post("/contact/bulk-audience", { contactIds: selectedIds, audienceId });
      showMessage("success", "Contacts added to audience");
      setAudienceId("");
      setSelectedIds([]);
      await loadData();
    } catch (error) {
      showMessage("error", error?.response?.data?.message || "Failed to update audience");
    }
  };

  const taggedCount = contacts.filter((contact) => safeArray(contact.tags).length).length;
  const dueFollowUps = contacts.filter(
    (contact) => contact.reminderAt && new Date(contact.reminderAt) <= new Date()
  ).length;
  const interestedCount = contacts.filter((contact) =>
    ["interested", "site_visit", "negotiation"].includes(contact.leadStage)
  ).length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Contacts</h1>
          <p style={styles.subtitle}>Manage leads, tags, audiences, imports, and bulk actions.</p>
        </div>
        <button style={styles.refreshBtn} onClick={loadData}>
          <FaSyncAlt /> Refresh
        </button>
      </div>

      {message.text ? (
        <div style={{ ...styles.message, ...(message.type === "success" ? styles.successMsg : styles.errorMsg) }}>
          {message.text}
        </div>
      ) : null}

      <div style={styles.statsGrid}>
        <StatCard icon={<FaUsers />} label="Total Contacts" value={contacts.length} />
        <StatCard icon={<FaTag />} label="Tagged Leads" value={taggedCount} />
        <StatCard icon={<FaLayerGroup />} label="Active Pipeline" value={interestedCount} />
        <StatCard icon={<FaFilter />} label="Due Follow-ups" value={dueFollowUps} />
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>{editingId ? "Edit Contact" : "Add Contact"}</h3>
          <label style={styles.label}>Full Name</label>
          <input style={styles.input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <label style={styles.label}>Phone Number</label>
          <input style={styles.input} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <label style={styles.label}>Tags</label>
          <input style={styles.input} value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Interested, Demo Lead" />
          <div style={styles.formGrid}>
            <label style={styles.label}>Lead Stage</label>
            <select style={styles.input} value={form.leadStage} onChange={(e) => setForm((p) => ({ ...p, leadStage: e.target.value }))}>
              {leadStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select>
            <label style={styles.label}>Deal Value</label>
            <input style={styles.input} value={form.dealValue} onChange={(e) => setForm((p) => ({ ...p, dealValue: e.target.value }))} placeholder="Budget / plan / value" />
            <label style={styles.label}>Requirement Type</label>
            <input style={styles.input} value={form.requirementType} onChange={(e) => setForm((p) => ({ ...p, requirementType: e.target.value }))} placeholder="Product, service, module" />
            <label style={styles.label}>Preference</label>
            <input style={styles.input} value={form.preference} onChange={(e) => setForm((p) => ({ ...p, preference: e.target.value }))} placeholder="Area, platform, product, priority" />
            <label style={styles.label}>Follow-up Reminder</label>
            <input style={styles.input} type="datetime-local" value={form.reminderAt} onChange={(e) => setForm((p) => ({ ...p, reminderAt: e.target.value }))} />
          </div>
          <div style={styles.buttonRow}>
            <button style={styles.primaryBtn} onClick={saveContact} disabled={saving}>
              <FaPlus /> {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </button>
            {editingId ? <button style={styles.lightBtn} onClick={resetForm}>Cancel</button> : null}
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Import CSV</h3>
          <input id="csvFileInput" type="file" accept=".csv" style={styles.fileInput} onChange={(e) => setFile(e.target.files[0])} />
          <button style={styles.primaryBtn} onClick={importCSV} disabled={importing}>
            <FaUpload /> {importing ? "Importing..." : "Import Contacts"}
          </button>
          <p style={styles.helperText}>Columns: name, phone, tags, leadStage, dealValue, requirementType, preference.</p>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <input style={styles.searchInput} placeholder="Search name, phone, or tag..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={styles.select} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
          <select style={styles.select} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="all">All stages</option>
            {leadStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
          </select>
          <select style={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>
        </div>

        <div style={styles.bulkBar}>
          <strong>{selectedIds.length} selected</strong>
          <input style={styles.bulkInput} value={bulkTags} onChange={(e) => setBulkTags(e.target.value)} placeholder="Add tags..." />
          <button style={styles.lightBtn} onClick={applyBulkTags}>Apply Tags</button>
          <select style={styles.bulkInput} value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
            <option value="">Select audience</option>
            {audiences.map((audience) => <option key={audience._id} value={audience._id}>{audience.name}</option>)}
          </select>
          <button style={styles.lightBtn} onClick={addToAudience}>Add to Audience</button>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Loading contacts...</div>
        ) : paginatedContacts.length === 0 ? (
          <div style={styles.emptyState}>No contacts found</div>
        ) : (
          <>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><input type="checkbox" onChange={toggleSelectPage} checked={paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedIds.includes(c._id))} /></th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Phone</th>
                    <th style={styles.th}>Stage</th>
                    <th style={styles.th}>Requirement</th>
                    <th style={styles.th}>Follow-up</th>
                    <th style={styles.th}>Tags</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContacts.map((contact) => (
                    <tr key={contact._id} style={styles.tr}>
                      <td style={styles.td}><input type="checkbox" checked={selectedIds.includes(contact._id)} onChange={() => toggleSelect(contact._id)} /></td>
                      <td style={styles.td}><strong>{contact.name}</strong></td>
                      <td style={styles.td}>{contact.phone}</td>
                      <td style={styles.td}>
                        <span style={styles.stageBadge}>
                          {leadStages.find((stage) => stage.value === (contact.leadStage || "new"))?.label || "New Lead"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.requirementText}>
                          {contact.dealValue || contact.budget || contact.requirementType || contact.propertyType || contact.preference || contact.preferredLocation
                            ? [contact.dealValue || contact.budget, contact.requirementType || contact.propertyType, contact.preference || contact.preferredLocation].filter(Boolean).join(" | ")
                            : "-"}
                        </div>
                      </td>
                      <td style={styles.td}>
                        {contact.reminderAt ? new Date(contact.reminderAt).toLocaleString() : "-"}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.tagWrap}>
                          {safeArray(contact.tags).length ? safeArray(contact.tags).map((tag) => <span key={tag} style={styles.tag}>{tag}</span>) : <span style={styles.muted}>No tags</span>}
                        </div>
                      </td>
                      <td style={styles.td}>{contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : "-"}</td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          <button style={styles.iconBtn} onClick={() => editContact(contact)}><FaEdit /></button>
                          <button style={styles.deleteBtn} onClick={() => deleteContact(contact._id)} disabled={deletingId === contact._id}>
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={styles.pagination}>
              <button style={styles.pageBtn} onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>Prev</button>
              <span style={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
              <button style={styles.pageBtn} onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div>
        <p style={styles.statLabel}>{label}</p>
        <h2 style={styles.statValue}>{Number(value || 0).toLocaleString()}</h2>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "20px" },
  title: { margin: 0, fontSize: "30px", color: "#0f172a" },
  subtitle: { marginTop: "6px", color: "#64748b", fontSize: "14px" },
  refreshBtn: { display: "inline-flex", alignItems: "center", gap: "8px", background: "#fff", border: "1px solid #dbeafe", color: "#2563eb", padding: "10px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" },
  message: { marginBottom: "18px", padding: "12px 16px", borderRadius: "8px", fontWeight: 700 },
  successMsg: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  errorMsg: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px", marginBottom: "18px" },
  statCard: { background: "#fff", borderRadius: "8px", padding: "16px", border: "1px solid #e2e8f0", display: "flex", gap: "12px", alignItems: "center" },
  statIcon: { width: "42px", height: "42px", borderRadius: "8px", background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center" },
  statLabel: { margin: 0, color: "#64748b", fontSize: "13px" },
  statValue: { margin: "5px 0 0", fontSize: "24px", color: "#0f172a" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "18px" },
  card: { background: "#fff", borderRadius: "8px", padding: "18px", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.05)" },
  cardTitle: { margin: "0 0 14px", fontSize: "18px", color: "#0f172a" },
  label: { display: "block", margin: "10px 0 6px", fontSize: "13px", color: "#334155", fontWeight: 700 },
  input: { width: "100%", padding: "11px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" },
  fileInput: { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", boxSizing: "border-box", marginBottom: "12px" },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "#16a34a", color: "#fff", border: "none", padding: "11px 14px", borderRadius: "8px", fontWeight: 800, cursor: "pointer" },
  lightBtn: { background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", padding: "10px 12px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" },
  buttonRow: { display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" },
  helperText: { marginTop: "10px", fontSize: "12px", color: "#64748b" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginTop: "10px" },
  toolbar: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 160px 160px 160px", gap: "10px", marginBottom: "14px" },
  searchInput: { width: "100%", padding: "11px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" },
  select: { padding: "11px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff" },
  bulkBar: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", marginBottom: "14px" },
  bulkInput: { minWidth: "180px", flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff" },
  tableWrapper: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1080px" },
  th: { textAlign: "left", padding: "12px", background: "#f8fafc", color: "#475569", fontSize: "13px", borderBottom: "1px solid #e2e8f0" },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "12px", color: "#0f172a", fontSize: "14px" },
  tagWrap: { display: "flex", gap: "6px", flexWrap: "wrap" },
  tag: { background: "#dcfce7", color: "#166534", borderRadius: "999px", padding: "5px 8px", fontSize: "12px", fontWeight: 800 },
  stageBadge: { background: "#ecfdf5", color: "#166534", borderRadius: "8px", padding: "6px 8px", fontSize: "12px", fontWeight: 800 },
  requirementText: { maxWidth: "240px", color: "#334155", lineHeight: 1.4 },
  muted: { color: "#94a3b8", fontSize: "13px" },
  actionRow: { display: "flex", gap: "8px" },
  iconBtn: { width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer" },
  deleteBtn: { width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fee2e2", color: "#b91c1c", cursor: "pointer" },
  emptyState: { padding: "40px 20px", textAlign: "center", color: "#64748b" },
  pagination: { marginTop: "16px", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  pageBtn: { padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 700 },
  pageInfo: { color: "#334155", fontWeight: 700 },
};

export default Contacts;

