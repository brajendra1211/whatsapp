import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";

const leadStages = [
  { value: "new", label: "New Lead" },
  { value: "interested", label: "Interested" },
  { value: "site_visit", label: "Demo / Visit" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
];

const defaultProfile = {
  name: "",
  leadStage: "new",
  leadSource: "",
  dealValue: "",
  requirementType: "",
  preference: "",
  reminderAt: "",
  reminderNote: "",
  profileNote: "",
};

function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [conversationState, setConversationState] = useState({
    status: "open",
    labelsText: "",
    assignedTo: "",
    note: "",
  });
  const [profileForm, setProfileForm] = useState(defaultProfile);
  const [timeline, setTimeline] = useState([]);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [savingState, setSavingState] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const toDateTimeInputValue = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoadingConversations(true);

      const res = await API.get("/inbox/conversations");
      const data = safeArray(res?.data?.conversations || []);
      setConversations(data);

      if (!selectedPhone && data.length) {
        setSelectedPhone(data[0].phone);
      }
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to load inbox");
    } finally {
      setLoadingConversations(false);
      setRefreshing(false);
    }
  }, [selectedPhone]);

  const loadMessages = useCallback(async (phone) => {
    if (!phone) return;

    try {
      setLoadingMessages(true);
      const [messageRes, timelineRes] = await Promise.all([
        API.get(`/inbox/messages/${phone}`),
        API.get(`/inbox/timeline/${phone}`),
      ]);
      const state = messageRes?.data?.state || {};
      setMessages(safeArray(messageRes?.data?.messages || []));
      const contact = messageRes?.data?.contact || timelineRes?.data?.contact || null;
      setSelectedContact(contact);
      setTimeline(safeArray(timelineRes?.data?.events || []));
      setProfileForm({
        name: contact?.name || "",
        leadStage: contact?.leadStage || "new",
        leadSource: contact?.leadSource || "",
        dealValue: contact?.dealValue || contact?.budget || "",
        requirementType: contact?.requirementType || contact?.propertyType || "",
        preference: contact?.preference || contact?.preferredLocation || "",
        reminderAt: toDateTimeInputValue(contact?.reminderAt),
        reminderNote: contact?.reminderNote || "",
        profileNote: contact?.profileNote || "",
      });
      setConversationState({
        status: state.status || "open",
        labelsText: safeArray(state.labels || []).join(", "),
        assignedTo: state.assignedTo || "",
        note: state.note || "",
      });
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
    }
  }, [selectedPhone, loadMessages]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((item) => {
      const q = search.toLowerCase();
      return (
        (item?.phone || "").toLowerCase().includes(q) ||
        (item?.name || "").toLowerCase().includes(q) ||
        (item?.lastMessage || "").toLowerCase().includes(q) ||
        safeArray(item?.labels).join(" ").toLowerCase().includes(q) ||
        safeArray(item?.contactTags).join(" ").toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.phone === selectedPhone);
  }, [conversations, selectedPhone]);

  const stats = useMemo(() => {
    const totalConversations = conversations.length;
    const inboundCount = conversations.filter((c) => c.lastDirection === "inbound").length;
    const outboundCount = conversations.filter((c) => c.lastDirection === "outbound").length;
    const failedCount = conversations.filter((c) => c.lastStatus === "failed").length;
    const handoffCount = conversations.filter((c) => c.needsAgent).length;
    const closedCount = conversations.filter((c) => c.conversationStatus === "closed").length;
    const optOutCount = conversations.filter((c) => c.optOut).length;
    const today = new Date();
    const reminderCount = conversations.filter((c) => {
      if (!c.reminderAt) return false;
      return new Date(c.reminderAt) <= today;
    }).length;

    return {
      totalConversations,
      inboundCount,
      outboundCount,
      failedCount,
      handoffCount,
      closedCount,
      optOutCount,
      reminderCount,
    };
  }, [conversations]);

  const labelsArray = useMemo(() => {
    return conversationState.labelsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [conversationState.labelsText]);

  const formatDateTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const formatTime = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSendReply = async () => {
    if (!selectedPhone) {
      showNotice("error", "Please select a conversation");
      return;
    }

    if (!reply.trim()) {
      showNotice("error", "Please enter a reply message");
      return;
    }

    if (selectedConversation?.optOut || selectedContact?.optOut) {
      showNotice("error", "This contact opted out. Reply is blocked.");
      return;
    }

    try {
      setSendingReply(true);

      await API.post("/inbox/reply", {
        phone: selectedPhone,
        message: reply.trim(),
      });

      showNotice("success", "Reply sent successfully");
      setReply("");

      await loadMessages(selectedPhone);
      await loadConversations(true);
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const getStageLabel = (stage) =>
    leadStages.find((item) => item.value === stage)?.label || "New Lead";

  const handleSaveState = async () => {
    if (!selectedPhone) return;

    try {
      setSavingState(true);
      const res = await API.put(`/inbox/state/${selectedPhone}`, {
        status: conversationState.status,
        labels: labelsArray,
        assignedTo: conversationState.assignedTo,
        note: conversationState.note,
      });

      const saved = res?.data?.state || {};
      setConversationState({
        status: saved.status || "open",
        labelsText: safeArray(saved.labels || []).join(", "),
        assignedTo: saved.assignedTo || "",
        note: saved.note || "",
      });

      setConversations((prev) =>
        prev.map((item) =>
          item.phone === selectedPhone
            ? {
                ...item,
                conversationStatus: saved.status || "open",
                labels: saved.labels || [],
                assignedTo: saved.assignedTo || "",
                note: saved.note || "",
              }
            : item
        )
      );

      showNotice("success", "Conversation updated");
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to save conversation");
    } finally {
      setSavingState(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedPhone) return;

    try {
      setSavingProfile(true);
      const payload = {
        ...profileForm,
        reminderAt: profileForm.reminderAt || null,
      };

      const res = await API.put(`/inbox/contact-profile/${selectedPhone}`, payload);
      const contact = res?.data?.contact || null;
      setSelectedContact(contact);
      setProfileForm({
        name: contact?.name || "",
        leadStage: contact?.leadStage || "new",
        leadSource: contact?.leadSource || "",
        dealValue: contact?.dealValue || contact?.budget || "",
        requirementType: contact?.requirementType || contact?.propertyType || "",
        preference: contact?.preference || contact?.preferredLocation || "",
        reminderAt: toDateTimeInputValue(contact?.reminderAt),
        reminderNote: contact?.reminderNote || "",
        profileNote: contact?.profileNote || "",
      });
      setConversations((prev) =>
        prev.map((item) =>
          item.phone === selectedPhone
            ? {
                ...item,
                name: contact?.name || item.name,
                leadStage: contact?.leadStage || "new",
                reminderAt: contact?.reminderAt || null,
                reminderNote: contact?.reminderNote || "",
                dealValue: contact?.dealValue || contact?.budget || "",
                requirementType: contact?.requirementType || contact?.propertyType || "",
                preference: contact?.preference || contact?.preferredLocation || "",
              }
            : item
        )
      );
      showNotice("success", "Customer profile updated");
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to save customer profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>Inbox</h1>
          <p style={styles.subtitle}>
            Manage incoming conversations and reply directly from your panel.
          </p>
        </div>

        <button
          style={styles.refreshBtn}
          onClick={() => {
            loadConversations(true);
            if (selectedPhone) loadMessages(selectedPhone);
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
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
          <p style={styles.statLabel}>Total Conversations</p>
          <h3 style={styles.statValue}>{stats.totalConversations}</h3>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Latest Inbound</p>
          <h3 style={styles.statValue}>{stats.inboundCount}</h3>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Latest Outbound</p>
          <h3 style={styles.statValue}>{stats.outboundCount}</h3>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Needs Agent</p>
          <h3 style={styles.statValue}>{stats.handoffCount}</h3>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Closed</p>
          <h3 style={styles.statValue}>{stats.closedCount}</h3>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Opted Out</p>
          <h3 style={styles.statValue}>{stats.optOutCount}</h3>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Due Follow-ups</p>
          <h3 style={styles.statValue}>{stats.reminderCount}</h3>
        </div>
      </div>

      <div style={styles.mainGrid}>
        <div style={styles.sidebarPanel}>
          <div style={styles.sidebarHeader}>
            <h3 style={styles.panelTitle}>Conversations</h3>
            <input
              style={styles.searchInput}
              placeholder="Search by phone or text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={styles.conversationList}>
            {loadingConversations ? (
              <div style={styles.emptyBox}>Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div style={styles.emptyBox}>No conversations found</div>
            ) : (
              filteredConversations.map((item) => (
                <button
                  key={item.phone}
                  onClick={() => setSelectedPhone(item.phone)}
                  style={{
                    ...styles.conversationCard,
                    ...(selectedPhone === item.phone ? styles.activeConversationCard : {}),
                  }}
                >
                  <div style={styles.conversationTop}>
                    <div>
                      <div style={styles.conversationName}>
                        {item.name || item.phone}
                      </div>
                      <div style={styles.conversationPhone}>{item.phone}</div>
                    </div>
                    <div style={styles.conversationTime}>
                      {item.needsAgent ? (
                        <span style={styles.agentBadge}>Agent</span>
                      ) : null}
                      {item.optOut ? <span style={styles.optOutBadge}>Opt-out</span> : null}
                      <span>{formatTime(item.lastMessageAt)}</span>
                    </div>
                  </div>

                  <div style={styles.conversationPreview}>
                    {item.lastMessage || "No message available"}
                  </div>

                  <div style={styles.conversationFooter}>
                    <span style={styles.stageBadge}>
                      {getStageLabel(item.leadStage)}
                    </span>
                    <span
                      style={{
                        ...styles.directionBadge,
                        background:
                          item.lastDirection === "inbound" ? "#dcfce7" : "#dbeafe",
                        color:
                          item.lastDirection === "inbound" ? "#166534" : "#1d4ed8",
                      }}
                    >
                      {item.lastDirection || "unknown"}
                    </span>

                    <span style={styles.statusBadge}>
                      {item.conversationStatus || "open"}
                    </span>

                    <span
                      style={{
                        ...styles.statusBadge,
                        background:
                          item.lastStatus === "failed"
                            ? "#fee2e2"
                            : item.lastStatus === "read"
                            ? "#dcfce7"
                            : "#f1f5f9",
                        color:
                          item.lastStatus === "failed"
                            ? "#991b1b"
                            : item.lastStatus === "read"
                            ? "#166534"
                            : "#475569",
                      }}
                    >
                      {item.lastStatus || "pending"}
                    </span>
                  </div>

                  {item.reminderAt ? (
                    <div style={styles.reminderLine}>
                      Follow-up: {formatDateTime(item.reminderAt)}
                    </div>
                  ) : null}

                  {safeArray(item.labels).length ? (
                    <div style={styles.badgeWrap}>
                      {safeArray(item.labels).slice(0, 3).map((label) => (
                        <span key={label} style={styles.labelBadge}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div style={styles.chatPanel}>
          {selectedConversation ? (
            <>
              <div style={styles.chatHeader}>
                <div>
                  <h3 style={styles.chatTitle}>
                    {selectedConversation.name || selectedConversation.phone}
                  </h3>
                  <p style={styles.chatSubTitle}>
                    {selectedConversation.phone}
                    {selectedConversation.needsAgent ? (
                      <span style={styles.agentBadgeInline}>Needs agent</span>
                    ) : null}
                    {selectedConversation.optOut ? (
                      <span style={styles.optOutBadgeInline}>Opted out</span>
                    ) : null}
                  </p>
                </div>

                <div style={styles.chatMeta}>
                  Last active: {formatDateTime(selectedConversation.lastMessageAt)}
                </div>
              </div>

              <div style={styles.crmPanel}>
                <div style={styles.crmGrid}>
                  <label style={styles.fieldLabel}>
                    Status
                    <select
                      style={styles.input}
                      value={conversationState.status}
                      onChange={(e) =>
                        setConversationState((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>

                  <label style={styles.fieldLabel}>
                    Assigned to
                    <input
                      style={styles.input}
                      value={conversationState.assignedTo}
                      onChange={(e) =>
                        setConversationState((prev) => ({
                          ...prev,
                          assignedTo: e.target.value,
                        }))
                      }
                      placeholder="Agent name"
                    />
                  </label>

                  <label style={styles.fieldLabel}>
                    Labels
                    <input
                      style={styles.input}
                      value={conversationState.labelsText}
                      onChange={(e) =>
                        setConversationState((prev) => ({
                          ...prev,
                          labelsText: e.target.value,
                        }))
                      }
                      placeholder="Hot lead, Billing"
                    />
                  </label>
                </div>

                <label style={styles.fieldLabel}>
                  Internal note
                  <textarea
                    style={styles.noteTextarea}
                    value={conversationState.note}
                    onChange={(e) =>
                      setConversationState((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Private note for your team"
                  />
                </label>

                <div style={styles.crmFooter}>
                  <div style={styles.badgeWrap}>
                    {labelsArray.map((label) => (
                      <span key={label} style={styles.labelBadge}>
                        {label}
                      </span>
                    ))}
                    {safeArray(selectedContact?.tags).map((tag) => (
                      <span key={tag} style={styles.contactTagBadge}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    style={styles.primaryBtn}
                    onClick={handleSaveState}
                    disabled={savingState}
                    type="button"
                  >
                    {savingState ? "Saving..." : "Save State"}
                  </button>
                </div>
              </div>

              <div style={styles.messagesWrap}>
                {loadingMessages ? (
                  <div style={styles.emptyBox}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={styles.emptyBox}>No messages in this conversation</div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={msg._id || index}
                      style={{
                        ...styles.messageRow,
                        justifyContent:
                          msg.direction === "outbound" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageBubble,
                          ...(msg.direction === "outbound"
                            ? styles.outboundBubble
                            : styles.inboundBubble),
                        }}
                      >
                        <div style={styles.messageText}>
                          {msg.message || "No text content"}
                        </div>

                        <div style={styles.messageMeta}>
                          <span>{formatDateTime(msg.createdAt)}</span>
                          <span style={{ marginLeft: "10px" }}>
                            {msg.status || "pending"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.replyBox}>
                {selectedConversation.optOut || selectedContact?.optOut ? (
                  <div style={styles.optOutNotice}>
                    Contact has opted out. Manual replies and automation sends are blocked.
                  </div>
                ) : null}

                <textarea
                  style={styles.replyTextarea}
                  placeholder="Type your reply here..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  disabled={selectedConversation.optOut || selectedContact?.optOut}
                />

                <div style={styles.replyActions}>
                  <button
                    style={styles.lightBtn}
                    onClick={() => setReply("")}
                    type="button"
                  >
                    Clear
                  </button>

                  <button
                    style={{
                      ...styles.primaryBtn,
                      ...(selectedConversation.optOut || selectedContact?.optOut
                        ? styles.disabledBtn
                        : {}),
                    }}
                    onClick={handleSendReply}
                    disabled={sendingReply || selectedConversation.optOut || selectedContact?.optOut}
                    type="button"
                  >
                    {sendingReply ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>

              <div style={styles.timelinePanel}>
                <h3 style={styles.panelTitle}>Contact Timeline</h3>
                <div style={styles.timelineList}>
                  {timeline.length ? (
                    timeline.slice(0, 8).map((event, index) => (
                      <div key={`${event.type}-${index}`} style={styles.timelineItem}>
                        <div style={styles.timelineDot} />
                        <div>
                          <div style={styles.timelineTitle}>{event.title}</div>
                          <div style={styles.timelineDetail}>{event.detail || "-"}</div>
                          <div style={styles.timelineTime}>{formatDateTime(event.createdAt)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={styles.emptyBox}>No timeline events yet</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={styles.emptyChat}>
              Select a conversation to view messages
            </div>
          )}
        </div>

        <aside style={styles.profilePanel}>
          {selectedConversation ? (
            <>
              <div style={styles.profileHeader}>
                <div>
                  <h3 style={styles.profileTitle}>Customer Profile</h3>
                  <p style={styles.profileSub}>{selectedPhone}</p>
                </div>
                <span style={styles.stageBadge}>{getStageLabel(profileForm.leadStage)}</span>
              </div>

              <div style={styles.profileBody}>
                <label style={styles.fieldLabel}>
                  Name
                  <input
                    style={styles.input}
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Customer name"
                  />
                </label>

                <label style={styles.fieldLabel}>
                  Lead Stage
                  <select
                    style={styles.input}
                    value={profileForm.leadStage}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, leadStage: e.target.value }))
                    }
                  >
                    {leadStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={styles.profileGrid}>
                  <label style={styles.fieldLabel}>
                    Deal Value
                    <input
                      style={styles.input}
                      value={profileForm.dealValue}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, dealValue: e.target.value }))
                      }
                      placeholder="e.g. Budget / plan / value"
                    />
                  </label>

                  <label style={styles.fieldLabel}>
                    Requirement Type
                    <input
                      style={styles.input}
                      value={profileForm.requirementType}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, requirementType: e.target.value }))
                      }
                      placeholder="Product, service, module"
                    />
                  </label>
                </div>

                <label style={styles.fieldLabel}>
                  Preference
                  <input
                    style={styles.input}
                    value={profileForm.preference}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        preference: e.target.value,
                      }))
                    }
                    placeholder="Area, platform, product, priority"
                  />
                </label>

                <label style={styles.fieldLabel}>
                  Lead Source
                  <input
                    style={styles.input}
                    value={profileForm.leadSource}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, leadSource: e.target.value }))
                    }
                    placeholder="Website, Facebook, referral"
                  />
                </label>

                <div style={styles.reminderBox}>
                  <label style={styles.fieldLabel}>
                    Follow-up Reminder
                    <input
                      style={styles.input}
                      type="datetime-local"
                      value={profileForm.reminderAt}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, reminderAt: e.target.value }))
                      }
                    />
                  </label>

                  <label style={styles.fieldLabel}>
                    Reminder Note
                    <textarea
                      style={styles.noteTextarea}
                      value={profileForm.reminderNote}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          reminderNote: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Call/demo/visit follow-up"
                    />
                  </label>
                </div>

                <label style={styles.fieldLabel}>
                  Profile Notes
                  <textarea
                    style={styles.noteTextarea}
                    value={profileForm.profileNote}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, profileNote: e.target.value }))
                    }
                    rows={3}
                    placeholder="Need, urgency, objections, decision maker, next step..."
                  />
                </label>

                <button
                  style={styles.primaryBtn}
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  type="button"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyBox}>Select a conversation to view customer profile</div>
          )}
        </aside>
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
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

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "330px minmax(0, 1fr) 320px",
    gap: "18px",
    alignItems: "start",
  },

  sidebarPanel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    height: "calc(100vh - 220px)",
    display: "flex",
    flexDirection: "column",
  },

  sidebarHeader: {
    padding: "18px",
    borderBottom: "1px solid #e2e8f0",
  },

  panelTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
    color: "#0f172a",
  },

  searchInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    outline: "none",
    boxSizing: "border-box",
  },

  conversationList: {
    padding: "12px",
    overflowY: "auto",
    display: "grid",
    gap: "10px",
  },

  conversationCard: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#fff",
    padding: "14px",
    cursor: "pointer",
  },

  activeConversationCard: {
    border: "1px solid #93c5fd",
    background: "#eff6ff",
  },

  conversationTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },

  conversationName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
  },

  conversationPhone: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "3px",
  },

  conversationTime: {
    fontSize: "12px",
    color: "#64748b",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  agentBadge: {
    padding: "4px 7px",
    borderRadius: "999px",
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: "800",
    fontSize: "11px",
  },
  agentBadgeInline: {
    display: "inline-flex",
    marginLeft: "10px",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: "800",
    fontSize: "11px",
  },
  optOutBadge: {
    padding: "4px 7px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: "800",
    fontSize: "11px",
  },
  optOutBadgeInline: {
    display: "inline-flex",
    marginLeft: "10px",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: "800",
    fontSize: "11px",
  },

  conversationPreview: {
    fontSize: "13px",
    color: "#334155",
    lineHeight: "1.5",
    marginBottom: "10px",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  conversationFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  directionBadge: {
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
  },

  statusBadge: {
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
  },

  chatPanel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minHeight: "calc(100vh - 220px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  chatHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },

  chatTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#0f172a",
  },

  chatSubTitle: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#64748b",
  },

  chatMeta: {
    fontSize: "12px",
    color: "#64748b",
  },

  crmPanel: {
    padding: "16px 18px",
    borderBottom: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  crmGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    marginBottom: "12px",
  },

  fieldLabel: {
    display: "grid",
    gap: "7px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: "700",
  },

  input: {
    width: "100%",
    minHeight: "40px",
    padding: "9px 11px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    outline: "none",
    boxSizing: "border-box",
    color: "#0f172a",
  },

  noteTextarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },

  crmFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "12px",
  },

  badgeWrap: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginTop: "8px",
  },

  labelBadge: {
    padding: "5px 8px",
    borderRadius: "999px",
    background: "#e0f2fe",
    color: "#075985",
    fontSize: "11px",
    fontWeight: "800",
  },

  contactTagBadge: {
    padding: "5px 8px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "11px",
    fontWeight: "800",
  },

  messagesWrap: {
    flex: 1,
    padding: "18px",
    background: "#f8fafc",
    overflowY: "auto",
  },

  messageRow: {
    display: "flex",
    marginBottom: "14px",
  },

  messageBubble: {
    maxWidth: "72%",
    borderRadius: "16px",
    padding: "12px 14px",
    boxShadow: "0 4px 12px rgba(15,23,42,0.05)",
  },

  inboundBubble: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
  },

  outboundBubble: {
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#0f172a",
  },

  messageText: {
    fontSize: "14px",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
  },

  messageMeta: {
    marginTop: "8px",
    fontSize: "11px",
    color: "#64748b",
  },

  replyBox: {
    borderTop: "1px solid #e2e8f0",
    padding: "16px",
    background: "#fff",
  },

  optOutNotice: {
    marginBottom: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: "13px",
    fontWeight: "700",
  },

  replyTextarea: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    fontSize: "14px",
  },

  replyActions: {
    marginTop: "12px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
  },

  lightBtn: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
  },

  primaryBtn: {
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
  },

  disabledBtn: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  timelinePanel: {
    borderTop: "1px solid #e2e8f0",
    padding: "16px 18px",
    background: "#ffffff",
  },

  timelineList: {
    display: "grid",
    gap: "12px",
  },

  timelineItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr",
    gap: "10px",
    alignItems: "start",
  },

  timelineDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "#2563eb",
    marginTop: "5px",
  },

  timelineTitle: {
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "800",
  },

  timelineDetail: {
    color: "#334155",
    fontSize: "13px",
    marginTop: "3px",
    lineHeight: "1.45",
  },

  timelineTime: {
    color: "#64748b",
    fontSize: "11px",
    marginTop: "4px",
  },

  emptyBox: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
  },


  stageBadge: {
    padding: "5px 9px",
    borderRadius: "8px",
    background: "#ecfdf5",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
  },

  reminderLine: {
    marginTop: "9px",
    padding: "8px 10px",
    borderRadius: "8px",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: "12px",
    fontWeight: "700",
  },

  profilePanel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minHeight: "calc(100vh - 220px)",
    overflow: "hidden",
  },

  profileHeader: {
    padding: "18px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },

  profileTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "17px",
  },

  profileSub: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },

  profileBody: {
    padding: "16px",
    display: "grid",
    gap: "12px",
  },

  profileGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
  },

  reminderBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "12px",
    padding: "12px",
    display: "grid",
    gap: "10px",
  },
  emptyChat: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "16px",
  },
};

export default Inbox;


