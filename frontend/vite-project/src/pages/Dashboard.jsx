import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBolt,
  FaBullhorn,
  FaCheckCircle,
  FaComments,
  FaExclamationTriangle,
  FaFileAlt,
  FaProjectDiagram,
  FaUsers,
  FaWhatsapp,
} from "react-icons/fa";
import API from "../services/api";

function Dashboard() {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [deliverySummary, setDeliverySummary] = useState({
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  });
  const [failedReports, setFailedReports] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [flows, setFlows] = useState([]);
  const [flowAnalytics, setFlowAnalytics] = useState({ totals: {}, analyticsByFlow: {} });
  const [conversations, setConversations] = useState([]);
  const [whatsAppStatus, setWhatsAppStatus] = useState({ connected: false, connection: null });

  const [loading, setLoading] = useState(true);
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

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [
        contactsRes,
        historyRes,
        deliveryRes,
        failedRes,
        analyticsRes,
        templatesRes,
        flowsRes,
        flowAnalyticsRes,
        conversationsRes,
        whatsappStatusRes,
      ] = await Promise.allSettled([
        API.get("/contact/list"),
        API.get("/campaign/history"),
        API.get("/campaign/delivery-status"),
        API.get("/campaign/failed-report"),
        API.get("/campaign/analytics"),
        API.get("/template/list"),
        API.get("/message-flows"),
        API.get("/message-flows/analytics/summary"),
        API.get("/inbox/conversations"),
        API.get("/whatsapp-setup/status"),
      ]);

      if (contactsRes.status === "fulfilled") {
        setContacts(safeArray(contactsRes.value?.data || []));
      }

      if (historyRes.status === "fulfilled") {
        setCampaigns(safeArray(historyRes.value?.data?.campaigns || []));
      }

      if (deliveryRes.status === "fulfilled") {
        setDeliverySummary(
          deliveryRes.value?.data?.summary || {
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            failed: 0,
          }
        );
      }

      if (failedRes.status === "fulfilled") {
        setFailedReports(safeArray(failedRes.value?.data?.failed || []));
      }

      if (analyticsRes.status === "fulfilled") {
        setAnalytics(safeArray(analyticsRes.value?.data?.analytics || []));
      }

      if (templatesRes.status === "fulfilled") {
        setTemplates(safeArray(templatesRes.value?.data?.templates || []));
      }

      if (flowsRes.status === "fulfilled") {
        setFlows(safeArray(flowsRes.value?.data?.flows || []));
      }

      if (flowAnalyticsRes.status === "fulfilled") {
        setFlowAnalytics({
          totals: flowAnalyticsRes.value?.data?.totals || {},
          analyticsByFlow: flowAnalyticsRes.value?.data?.analyticsByFlow || {},
        });
      }

      if (conversationsRes.status === "fulfilled") {
        setConversations(safeArray(conversationsRes.value?.data?.conversations || []));
      }

      if (whatsappStatusRes.status === "fulfilled") {
        setWhatsAppStatus(
          whatsappStatusRes.value?.data || { connected: false, connection: null }
        );
      }
    } catch {
      showNotice("error", "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString();
  };

  const formatPercent = (value) => {
    return `${Number(value || 0).toFixed(1)}%`;
  };

  const deliveryRate = useMemo(() => {
    if (!deliverySummary.sent) return 0;
    return (deliverySummary.delivered / deliverySummary.sent) * 100;
  }, [deliverySummary]);

  const readRate = useMemo(() => {
    if (!deliverySummary.delivered) return 0;
    return (deliverySummary.read / deliverySummary.delivered) * 100;
  }, [deliverySummary]);

  const responseRate = useMemo(() => {
    if (!deliverySummary.read) return 0;
    return (deliverySummary.replied / deliverySummary.read) * 100;
  }, [deliverySummary]);

  const failureRate = useMemo(() => {
    if (!deliverySummary.sent) return 0;
    return (deliverySummary.failed / deliverySummary.sent) * 100;
  }, [deliverySummary]);

  const approvedTemplates = useMemo(() => {
    return templates.filter((t) => t.metaStatus === "APPROVED").length;
  }, [templates]);

  const pendingTemplates = useMemo(() => {
    return templates.filter((t) =>
      ["PENDING", "PENDING_SUBMISSION", "IN_REVIEW"].includes(t.metaStatus)
    ).length;
  }, [templates]);

  const rejectedTemplates = useMemo(() => {
    return templates.filter((t) =>
      ["REJECTED", "SUBMISSION_FAILED"].includes(t.metaStatus)
    ).length;
  }, [templates]);

  const templateApprovalRate = useMemo(() => {
    if (!templates.length) return 0;
    return (approvedTemplates / templates.length) * 100;
  }, [templates, approvedTemplates]);

  const recentCampaigns = useMemo(() => {
    return campaigns.slice(0, 5);
  }, [campaigns]);

  const activeFlows = useMemo(() => {
    return flows.filter((flow) => flow.status === "active").length;
  }, [flows]);

  const flowCompletionRate = useMemo(() => {
    const totals = flowAnalytics.totals || {};
    if (!totals.entered) return 0;
    return (Number(totals.completed || 0) / Number(totals.entered || 0)) * 100;
  }, [flowAnalytics]);

  const handoffConversations = useMemo(() => {
    return conversations.filter((item) => item.needsAgent).length;
  }, [conversations]);

  const latestInboundConversations = useMemo(() => {
    return conversations.filter((item) => item.lastDirection === "inbound").length;
  }, [conversations]);

  const chartMax = useMemo(() => {
    const values = analytics.map((a) => Number(a.total || 0));
    return Math.max(...values, 1);
  }, [analytics]);

  const todayMessages = useMemo(() => {
    if (!analytics.length) return 0;
    return Number(analytics[analytics.length - 1]?.total || 0);
  }, [analytics]);

  const recentActivities = useMemo(() => {
    const items = [];

    if (campaigns.length) {
      items.push(
        `Latest campaign "${campaigns[0]?.campaign_name || campaigns[0]?.name || "Campaign"}" is ${String(
          campaigns[0]?.status || "active"
        ).toLowerCase()}.`
      );
    }

    if (contacts.length) {
      items.push(`${formatNumber(contacts.length)} contacts are available in your database.`);
    }

    if (approvedTemplates) {
      items.push(`${approvedTemplates} Meta approved templates are ready to use.`);
    }

    if (pendingTemplates) {
      items.push(`${pendingTemplates} templates are waiting for Meta review.`);
    }

    if (failedReports.length) {
      items.push(`${failedReports.length} failed message attempts need attention.`);
    }

    if (handoffConversations) {
      items.push(`${handoffConversations} conversations need an agent in Inbox.`);
    }

    if (activeFlows) {
      items.push(`${activeFlows} automation flows are actively listening.`);
    }

    if (!items.length) {
      items.push("No recent activity available yet.");
    }

    return items.slice(0, 5);
  }, [
    campaigns,
    contacts.length,
    approvedTemplates,
    pendingTemplates,
    failedReports.length,
    handoffConversations,
    activeFlows,
  ]);

  const stats = [
    {
      title: "Total Contacts",
      value: formatNumber(contacts.length),
      sub: `${approvedTemplates} approved templates`,
      icon: <FaUsers />,
    },
    {
      title: "Campaigns Sent",
      value: formatNumber(campaigns.length),
      sub: `${pendingTemplates} pending review items`,
      icon: <FaBullhorn />,
    },
    {
      title: "Messages Sent",
      value: formatNumber(deliverySummary.sent),
      sub: `${formatNumber(deliverySummary.read)} messages read`,
      icon: <FaComments />,
    },
    {
      title: "Delivery Rate",
      value: formatPercent(deliveryRate),
      sub: `${formatNumber(deliverySummary.delivered)} delivered`,
      icon: <FaCheckCircle />,
    },
  ];
  const performanceData = [
    { label: "API Delivery Rate", value: deliveryRate, color: "#22c55e" },
    { label: "Template Approval Rate", value: templateApprovalRate, color: "#3b82f6" },
    { label: "Message Read Rate", value: readRate, color: "#f59e0b" },
    { label: "Response Rate", value: responseRate, color: "#8b5cf6" },
  ];

  stats.push(
    {
      title: "Active Flows",
      value: formatNumber(activeFlows),
      sub: `${formatNumber(flowAnalytics.totals?.entered)} users entered automation`,
      icon: <FaProjectDiagram />,
    },
    {
      title: "Needs Agent",
      value: formatNumber(handoffConversations),
      sub: `${formatNumber(latestInboundConversations)} latest inbound threads`,
      icon: <FaExclamationTriangle />,
    }
  );

  performanceData.push({
    label: "Flow Completion Rate",
    value: flowCompletionRate,
    color: "#14b8a6",
  });

  const automationCards = [
    { label: "Users Entered", value: flowAnalytics.totals?.entered || 0 },
    { label: "Completed", value: flowAnalytics.totals?.completed || 0 },
    { label: "Awaiting Reply", value: flowAnalytics.totals?.awaitingReply || 0 },
    { label: "Handoff", value: flowAnalytics.totals?.handoff || 0 },
  ];

  const riskItems = [];

  if (!whatsAppStatus.connected) {
    riskItems.push({ title: "WhatsApp is not connected", action: "/whatsapp-setup", tone: "danger" });
  }

  if (!approvedTemplates) {
    riskItems.push({ title: "No approved Meta templates", action: "/templates", tone: "warn" });
  }

  if (failureRate > 10) {
    riskItems.push({ title: `Failure rate is ${formatPercent(failureRate)}`, action: "/reports", tone: "danger" });
  }

  if (handoffConversations) {
    riskItems.push({ title: `${handoffConversations} conversations need agent`, action: "/inbox", tone: "warn" });
  }

  if (!activeFlows) {
    riskItems.push({ title: "No active automation flows", action: "/message-flows", tone: "info" });
  }

  if (!riskItems.length) {
    riskItems.push({ title: "System looks healthy", action: "/reports", tone: "ok" });
  }

  const getStatusStyle = (status) => {
    const s = String(status || "").toLowerCase();

    if (s === "completed" || s === "sent") {
      return { color: "#166534", background: "#dcfce7" };
    }

    if (s === "running" || s === "processing") {
      return { color: "#1d4ed8", background: "#dbeafe" };
    }

    if (s === "scheduled") {
      return { color: "#92400e", background: "#fef3c7" };
    }

    if (s === "failed") {
      return { color: "#991b1b", background: "#fee2e2" };
    }

    return { color: "#374151", background: "#f3f4f6" };
  };

  if (loading) {
    return <div style={styles.loading}>Loading dashboard...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>WhatsApp SaaS Dashboard</h1>
          <p style={styles.subtitle}>
            Monitor campaigns, templates, delivery, engagement, and API performance in one place.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            style={styles.secondaryButton}
            onClick={() => navigate("/contacts")}
          >
            Import Contacts
          </button>

          <button
            style={styles.primaryButton}
            onClick={() => navigate("/campaigns")}
          >
            + Create Campaign
          </button>

          <button
            style={styles.refreshButton}
            onClick={() => loadDashboard(true)}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
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

      <div style={styles.banner}>
        <div>
          <h3 style={styles.bannerTitle}>Meta API Overview</h3>
          <p style={styles.bannerText}>
            Delivery rate is {formatPercent(deliveryRate)}, approved templates are {approvedTemplates},
            and failed reports are {failedReports.length}.
          </p>
        </div>
        <div style={styles.bannerBadge}>
          <FaCheckCircle />
          Quality: {deliveryRate >= 90 ? "High" : deliveryRate >= 70 ? "Medium" : "Low"}
        </div>
      </div>

      <div style={styles.statsGrid}>
        {stats.map((item, index) => (
          <div key={index} style={styles.card}>
            <div style={styles.cardTop}>
              <div>
                <p style={styles.cardLabel}>{item.title}</p>
                <h2 style={styles.cardValue}>{item.value}</h2>
              </div>
              <div style={styles.iconBox}>{item.icon}</div>
            </div>
            <p style={styles.changeText}>{item.sub}</p>
          </div>
        ))}
      </div>

      <div style={styles.commandGrid}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Automation Command Center</h3>
            <span style={styles.panelTag}>Flows</span>
          </div>

          <div style={styles.automationGrid}>
            {automationCards.map((item) => (
              <div key={item.label} style={styles.automationMetric}>
                <span>{item.label}</span>
                <strong>{formatNumber(item.value)}</strong>
              </div>
            ))}
          </div>

          <div style={styles.infoBox}>
            <h4 style={styles.infoTitle}>Flow Health</h4>
            <p style={styles.infoText}>Active flows: {activeFlows}</p>
            <p style={styles.infoText}>Completion rate: {formatPercent(flowCompletionRate)}</p>
            <p style={styles.infoText}>Users awaiting reply: {formatNumber(flowAnalytics.totals?.awaitingReply)}</p>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Action Queue</h3>
            <span style={styles.panelTag}>Priority</span>
          </div>

          <div style={styles.riskList}>
            {riskItems.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                style={{ ...styles.riskItem, ...(styles[`risk_${item.tone}`] || {}) }}
                onClick={() => navigate(item.action)}
              >
                <FaExclamationTriangle />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.middleGrid}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Performance Overview</h3>
            <span style={styles.panelTag}>Live</span>
          </div>

          <div style={{ marginTop: "20px" }}>
            {performanceData.map((item, index) => (
              <div key={index} style={{ marginBottom: "18px" }}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>{item.label}</span>
                  <span style={styles.progressValue}>{formatPercent(item.value)}</span>
                </div>
                <div style={styles.progressBarBg}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${Math.min(Number(item.value || 0), 100)}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={styles.infoBox}>
            <h4 style={styles.infoTitle}>System Snapshot</h4>
            <p style={styles.infoText}>Messages sent today: {formatNumber(todayMessages)}</p>
            <p style={styles.infoText}>Delivered: {formatNumber(deliverySummary.delivered)}</p>
            <p style={styles.infoText}>Replies received: {formatNumber(deliverySummary.replied)}</p>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Quick Actions</h3>
            <span style={styles.panelTag}>Shortcuts</span>
          </div>

          <div style={styles.quickActionsGrid}>
            <button style={styles.quickActionCard} onClick={() => navigate("/campaigns")}>
              <FaBullhorn /> New Broadcast
            </button>
            <button style={styles.quickActionCard} onClick={() => navigate("/templates")}>
              <FaFileAlt /> Create Template
            </button>
            <button style={styles.quickActionCard} onClick={() => navigate("/contacts")}>
              <FaUsers /> Import Leads
            </button>
            <button style={styles.quickActionCard} onClick={() => navigate("/inbox")}>
              <FaComments /> Open Inbox
            </button>
            <button style={styles.quickActionCard} onClick={() => navigate("/message-flows")}>
              <FaBolt /> Build Flow
            </button>
            <button style={styles.quickActionCard} onClick={() => navigate("/whatsapp-setup")}>
              <FaWhatsapp /> WhatsApp Setup
            </button>
          </div>

          <div style={styles.infoBox}>
            <h4 style={styles.infoTitle}>Template Health</h4>
            <p style={styles.infoText}>Approved: {approvedTemplates}</p>
            <p style={styles.infoText}>Pending: {pendingTemplates}</p>
            <p style={styles.infoText}>Rejected: {rejectedTemplates}</p>
          </div>
        </div>
      </div>

      <div style={styles.chartPanel}>
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>Campaign Analytics</h3>
          <button style={styles.linkButton} onClick={() => navigate("/campaigns")}>
            View Campaigns
          </button>
        </div>

        {analytics.length === 0 ? (
          <div style={styles.emptyBox}>No analytics data available</div>
        ) : (
          <div style={styles.chartWrap}>
            {analytics.map((item, index) => {
              const value = Number(item.total || 0);
              const height = `${(value / chartMax) * 180}px`;

              return (
                <div key={index} style={styles.barItem}>
                  <div style={styles.barValue}>{formatNumber(value)}</div>
                  <div style={{ ...styles.bar, height }} />
                  <div style={styles.barLabel}>
                    {item.label || `Day ${index + 1}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>Recent Campaigns</h3>
          <button style={styles.linkButton} onClick={() => navigate("/campaigns")}>
            View All
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Campaign Name</th>
                <th style={styles.th}>Audience</th>
                <th style={styles.th}>Sent</th>
                <th style={styles.th}>Delivered</th>
                <th style={styles.th}>Failed</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.emptyCell}>
                    No campaigns available
                  </td>
                </tr>
              ) : (
                recentCampaigns.map((campaign, index) => (
                  <tr key={campaign._id || index} style={styles.tr}>
                    <td style={styles.td}>
                      {campaign.campaign_name || campaign.name || "-"}
                    </td>
                    <td style={styles.td}>
                      {campaign.audience_name || campaign.audience || "All Contacts"}
                    </td>
                    <td style={styles.td}>{formatNumber(campaign.sent || campaign.total || 0)}</td>
                    <td style={styles.td}>{formatNumber(campaign.delivered || 0)}</td>
                    <td style={styles.td}>{formatNumber(campaign.failed || 0)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...getStatusStyle(campaign.status),
                        }}
                      >
                        {campaign.status || "Unknown"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.bottomGrid}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Recent Activity</h3>
            <span style={styles.panelTag}>Updates</span>
          </div>

          <div style={{ marginTop: "14px" }}>
            {recentActivities.map((activity, index) => (
              <div key={index} style={styles.activityItem}>
                <div style={styles.activityDot} />
                <p style={styles.activityText}>{activity}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Compliance & Limits</h3>
            <span style={styles.panelTag}>Meta</span>
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={styles.limitRow}>
              <span style={styles.limitLabel}>Delivery Success</span>
              <strong>{formatPercent(deliveryRate)}</strong>
            </div>
            <div style={styles.limitRow}>
              <span style={styles.limitLabel}>Read Rate</span>
              <strong>{formatPercent(readRate)}</strong>
            </div>
            <div style={styles.limitRow}>
              <span style={styles.limitLabel}>Response Rate</span>
              <strong>{formatPercent(responseRate)}</strong>
            </div>
            <div style={styles.limitRow}>
              <span style={styles.limitLabel}>Failure Rate</span>
              <strong style={{ color: failureRate > 10 ? "#dc2626" : "#16a34a" }}>
                {formatPercent(failureRate)}
              </strong>
            </div>
            <div style={styles.limitRow}>
              <span style={styles.limitLabel}>Approved Templates</span>
              <strong style={{ color: "#2563eb" }}>{approvedTemplates}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "18px 2px 24px",
    fontFamily: "Inter, Arial, sans-serif",
  },

  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "700",
    color: "#334155",
  },

  notice: {
    marginBottom: "18px",
    padding: "12px 16px",
    borderRadius: "8px",
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

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "14px",
    marginBottom: "18px",
  },

  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
    color: "#0f172a",
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  primaryButton: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "none",
  },

  secondaryButton: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px 14px",
    fontWeight: "600",
    cursor: "pointer",
  },

  refreshButton: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    fontWeight: "600",
    cursor: "pointer",
  },

  banner: {
    background: "#fff",
    color: "#0f172a",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "14px",
    marginBottom: "18px",
    border: "1px solid #e2e8f0",
  },

  bannerTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
  },

  bannerText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },

  bannerBadge: {
    background: "#ecfdf5",
    color: "#166534",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  card: {
    background: "#fff",
    borderRadius: "8px",
    padding: "16px",
    boxShadow: "none",
    border: "1px solid #e2e8f0",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardLabel: {
    margin: 0,
    fontSize: "14px",
    color: "#64748b",
  },

  cardValue: {
    margin: "6px 0 0",
    fontSize: "24px",
    color: "#0f172a",
  },

  iconBox: {
    width: "42px",
    height: "42px",
    borderRadius: "8px",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  changeText: {
    marginTop: "14px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
  },

  middleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  commandGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
    gap: "12px",
    marginBottom: "18px",
  },

  automationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },

  automationMetric: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "12px",
    display: "grid",
    gap: "8px",
  },

  riskList: {
    display: "grid",
    gap: "10px",
    marginTop: "14px",
  },

  riskItem: {
    minHeight: "46px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#f8fafc",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    cursor: "pointer",
    fontWeight: "700",
    textAlign: "left",
  },

  risk_danger: {
    background: "#fee2e2",
    borderColor: "#fecaca",
    color: "#991b1b",
  },

  risk_warn: {
    background: "#fef3c7",
    borderColor: "#fde68a",
    color: "#92400e",
  },

  risk_info: {
    background: "#dbeafe",
    borderColor: "#bfdbfe",
    color: "#1d4ed8",
  },

  risk_ok: {
    background: "#dcfce7",
    borderColor: "#bbf7d0",
    color: "#166534",
  },

  chartPanel: {
    background: "#fff",
    borderRadius: "8px",
    padding: "16px",
    boxShadow: "none",
    border: "1px solid #e2e8f0",
    marginBottom: "18px",
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
    background: "#16a34a",
    borderRadius: "10px 10px 0 0",
  },

  barLabel: {
    fontSize: "12px",
    color: "#64748b",
    textAlign: "center",
  },

  panel: {
    background: "#fff",
    borderRadius: "8px",
    padding: "16px",
    boxShadow: "none",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  panelTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
  },

  panelTag: {
    background: "#f1f5f9",
    color: "#475569",
    padding: "6px 10px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
  },

  progressLabel: {
    fontSize: "14px",
    color: "#334155",
    fontWeight: "500",
  },

  progressValue: {
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: "700",
  },

  progressBarBg: {
    width: "100%",
    height: "10px",
    background: "#e2e8f0",
    borderRadius: "8px",
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    borderRadius: "8px",
  },

  quickActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },

  quickActionCard: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    fontWeight: "600",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  infoBox: {
    marginTop: "14px",
    background: "#f8fafc",
    borderRadius: "8px",
    padding: "12px",
    border: "1px solid #e2e8f0",
  },

  infoTitle: {
    margin: "0 0 10px",
    color: "#0f172a",
    fontSize: "14px",
  },

  infoText: {
    margin: "6px 0",
    color: "#475569",
    fontSize: "14px",
  },

  tableWrapper: {
    overflowX: "auto",
    marginTop: "14px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "750px",
  },

  th: {
    textAlign: "left",
    padding: "14px 12px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "13px",
    fontWeight: "700",
    borderBottom: "1px solid #e2e8f0",
  },

  tr: {
    borderBottom: "1px solid #f1f5f9",
  },

  td: {
    padding: "14px 12px",
    color: "#0f172a",
    fontSize: "14px",
  },

  emptyCell: {
    textAlign: "center",
    padding: "18px 2px 24px",
    color: "#64748b",
    fontSize: "14px",
  },

  emptyBox: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
  },

  statusBadge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
  },

  linkButton: {
    background: "transparent",
    border: "none",
    color: "#2563eb",
    fontWeight: "700",
    cursor: "pointer",
  },

  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "12px",
  },

  activityItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  activityDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#3b82f6",
    marginTop: "7px",
    flexShrink: 0,
  },

  activityText: {
    margin: 0,
    color: "#334155",
    fontSize: "14px",
    lineHeight: "1.5",
  },

  limitRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "14px",
  },

  limitLabel: {
    color: "#475569",
  },
};

export default Dashboard;




