import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaChartLine,
  FaDownload,
  FaExclamationTriangle,
  FaFileAlt,
  FaRedo,
  FaUsers,
} from "react-icons/fa";
import API from "../services/api";

const safeArray = (value) => (Array.isArray(value) ? value : []);

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const downloadCSV = (filename, rows) => {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function Reports() {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [failedReports, setFailedReports] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [deliverySummary, setDeliverySummary] = useState({
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState("overview");
  const [dateRange, setDateRange] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState({ type: "", text: "" });

  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice({ type: "", text: "" }), 3000);
  };

  const loadReports = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [
        campaignsRes,
        deliveryRes,
        failedRes,
        analyticsRes,
        contactsRes,
        templatesRes,
      ] = await Promise.allSettled([
        API.get("/campaign/history"),
        API.get("/campaign/delivery-status"),
        API.get("/campaign/failed-report"),
        API.get("/campaign/analytics"),
        API.get("/contact/list"),
        API.get("/template/list"),
      ]);

      if (campaignsRes.status === "fulfilled") {
        setCampaigns(safeArray(campaignsRes.value?.data?.campaigns));
      }
      if (deliveryRes.status === "fulfilled") {
        setDeliverySummary(deliveryRes.value?.data?.summary || {});
      }
      if (failedRes.status === "fulfilled") {
        setFailedReports(safeArray(failedRes.value?.data?.failed));
      }
      if (analyticsRes.status === "fulfilled") {
        setAnalytics(safeArray(analyticsRes.value?.data?.analytics));
      }
      if (contactsRes.status === "fulfilled") {
        setContacts(safeArray(contactsRes.value?.data));
      }
      if (templatesRes.status === "fulfilled") {
        setTemplates(safeArray(templatesRes.value?.data?.templates || templatesRes.value?.data));
      }
    } catch {
      showNotice("error", "Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredCampaigns = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);

    if (dateRange === "7d") cutoff.setDate(now.getDate() - 7);
    if (dateRange === "30d") cutoff.setDate(now.getDate() - 30);
    if (dateRange === "90d") cutoff.setDate(now.getDate() - 90);

    return campaigns.filter((campaign) => {
      const createdAt = new Date(campaign.createdAt || campaign.date || 0);
      const inRange = dateRange === "all" || createdAt >= cutoff;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        String(campaign.campaign_name || campaign.name || "")
          .toLowerCase()
          .includes(query) ||
        String(campaign.audience_name || campaign.audience || "")
          .toLowerCase()
          .includes(query) ||
        String(campaign.status || "").toLowerCase().includes(query);

      return inRange && matchesSearch;
    });
  }, [campaigns, dateRange, search]);

  const totals = useMemo(() => {
    const campaignTotals = filteredCampaigns.reduce(
      (acc, campaign) => {
        acc.total += Number(campaign.total || 0);
        acc.sent += Number(campaign.sent || 0);
        acc.delivered += Number(campaign.delivered || 0);
        acc.read += Number(campaign.read || 0);
        acc.replied += Number(campaign.replied || 0);
        acc.failed += Number(campaign.failed || 0);
        return acc;
      },
      { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 }
    );

    return {
      totalCampaigns: filteredCampaigns.length,
      totalContacts: contacts.length,
      totalTemplates: templates.length,
      approvedTemplates: templates.filter((t) => t.metaStatus === "APPROVED").length,
      failedNumbers: failedReports.length,
      sent: campaignTotals.sent || deliverySummary.sent || 0,
      delivered: campaignTotals.delivered || deliverySummary.delivered || 0,
      read: campaignTotals.read || deliverySummary.read || 0,
      replied: campaignTotals.replied || deliverySummary.replied || 0,
      failed: campaignTotals.failed || deliverySummary.failed || 0,
    };
  }, [filteredCampaigns, contacts.length, templates, failedReports.length, deliverySummary]);

  const deliveryRate = totals.sent ? (totals.delivered / totals.sent) * 100 : 0;
  const readRate = totals.delivered ? (totals.read / totals.delivered) * 100 : 0;
  const failureRate = totals.sent ? (totals.failed / totals.sent) * 100 : 0;
  const templateApprovalRate = totals.totalTemplates
    ? (totals.approvedTemplates / totals.totalTemplates) * 100
    : 0;

  const chartMax = useMemo(() => {
    return Math.max(...analytics.map((item) => Number(item.total || 0)), 1);
  }, [analytics]);

  const exportCampaigns = () => {
    downloadCSV("campaign_report.csv", [
      ["Campaign", "Audience", "Status", "Total", "Sent", "Delivered", "Read", "Replied", "Failed", "Created At"],
      ...filteredCampaigns.map((campaign) => [
        campaign.campaign_name || campaign.name || "",
        campaign.audience_name || campaign.audience || "All Contacts",
        campaign.status || "",
        campaign.total || 0,
        campaign.sent || 0,
        campaign.delivered || 0,
        campaign.read || 0,
        campaign.replied || 0,
        campaign.failed || 0,
        formatDate(campaign.createdAt || campaign.date),
      ]),
    ]);
  };

  const exportFailed = () => {
    downloadCSV("failed_numbers_report.csv", [
      ["Phone", "Campaign", "Reason", "Date"],
      ...failedReports.map((item) => [
        item.phone || "",
        item.campaign_name || "",
        item.reason || "",
        formatDate(item.createdAt),
      ]),
    ]);
  };

  const exportSummary = () => {
    downloadCSV("business_summary_report.csv", [
      ["Metric", "Value"],
      ["Campaigns", totals.totalCampaigns],
      ["Contacts", totals.totalContacts],
      ["Templates", totals.totalTemplates],
      ["Approved Templates", totals.approvedTemplates],
      ["Messages Sent", totals.sent],
      ["Delivered", totals.delivered],
      ["Read", totals.read],
      ["Replied", totals.replied],
      ["Failed", totals.failed],
      ["Delivery Rate", formatPercent(deliveryRate)],
      ["Read Rate", formatPercent(readRate)],
      ["Failure Rate", formatPercent(failureRate)],
      ["Template Approval Rate", formatPercent(templateApprovalRate)],
    ]);
  };

  if (loading) {
    return <div style={styles.loading}>Loading reports...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Reports</h1>
          <p style={styles.subtitle}>
            Campaign performance, delivery health, failed numbers, templates, and contact reporting.
          </p>
        </div>

        <div style={styles.actions}>
          <button style={styles.secondaryButton} onClick={() => loadReports(true)} disabled={refreshing}>
            <FaRedo />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button style={styles.primaryButton} onClick={exportSummary}>
            <FaDownload />
            Export Summary
          </button>
        </div>
      </div>

      {notice.text ? (
        <div style={{ ...styles.notice, ...(notice.type === "error" ? styles.noticeError : styles.noticeSuccess) }}>
          {notice.text}
        </div>
      ) : null}

      <div style={styles.toolbar}>
        <div style={styles.segmented}>
          {[
            ["overview", "Overview"],
            ["campaigns", "Campaigns"],
            ["failed", "Failed"],
            ["templates", "Templates"],
          ].map(([value, label]) => (
            <button
              key={value}
              style={{
                ...styles.segmentButton,
                ...(reportType === value ? styles.segmentButtonActive : {}),
              }}
              onClick={() => setReportType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <select style={styles.select} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>

        <input
          style={styles.search}
          placeholder="Search campaign, audience, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={styles.statsGrid}>
        <StatCard title="Campaigns" value={formatNumber(totals.totalCampaigns)} sub="Filtered campaign count" icon={<FaChartLine />} />
        <StatCard title="Contacts" value={formatNumber(totals.totalContacts)} sub="Available recipients" icon={<FaUsers />} />
        <StatCard title="Delivery Rate" value={formatPercent(deliveryRate)} sub={`${formatNumber(totals.delivered)} delivered`} icon={<FaFileAlt />} />
        <StatCard title="Failure Rate" value={formatPercent(failureRate)} sub={`${formatNumber(totals.failed)} failed`} icon={<FaExclamationTriangle />} danger={failureRate > 10} />
      </div>

      {reportType === "overview" && (
        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Delivery Funnel</h2>
              <button style={styles.linkButton} onClick={exportCampaigns}>
                <FaDownload /> Export Campaigns
              </button>
            </div>

            <div style={styles.funnel}>
              {[
                ["Sent", totals.sent, "#2563eb"],
                ["Delivered", totals.delivered, "#16a34a"],
                ["Read", totals.read, "#f59e0b"],
                ["Replied", totals.replied, "#7c3aed"],
                ["Failed", totals.failed, "#dc2626"],
              ].map(([label, value, color]) => {
                const width = totals.sent ? Math.max((Number(value) / totals.sent) * 100, 4) : 4;
                return (
                  <div key={label} style={styles.funnelRow}>
                    <div style={styles.funnelLabel}>
                      <span>{label}</span>
                      <strong>{formatNumber(value)}</strong>
                    </div>
                    <div style={styles.progressBg}>
                      <div style={{ ...styles.progressFill, width: `${Math.min(width, 100)}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Daily Sending Trend</h2>
              <span style={styles.badge}>{analytics.length} points</span>
            </div>

            {analytics.length ? (
              <div style={styles.chart}>
                {analytics.map((item, index) => {
                  const value = Number(item.total || 0);
                  return (
                    <div key={`${item.label}-${index}`} style={styles.barWrap}>
                      <span style={styles.barValue}>{formatNumber(value)}</span>
                      <div style={{ ...styles.bar, height: `${Math.max((value / chartMax) * 170, 8)}px` }} />
                      <span style={styles.barLabel}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.empty}>No analytics data available</div>
            )}
          </section>
        </div>
      )}

      {reportType === "campaigns" && (
        <ReportTable
          title="Campaign Report"
          actionLabel="Export Campaigns"
          onAction={exportCampaigns}
          headers={["Campaign", "Audience", "Status", "Sent", "Delivered", "Failed", "Created"]}
          rows={filteredCampaigns.map((campaign) => [
            campaign.campaign_name || campaign.name || "-",
            campaign.audience_name || campaign.audience || "All Contacts",
            campaign.status || "-",
            formatNumber(campaign.sent),
            formatNumber(campaign.delivered),
            formatNumber(campaign.failed),
            formatDate(campaign.createdAt || campaign.date),
          ])}
        />
      )}

      {reportType === "failed" && (
        <ReportTable
          title="Failed Numbers Report"
          actionLabel="Export Failed"
          onAction={exportFailed}
          headers={["Phone", "Campaign", "Reason", "Date"]}
          rows={failedReports.map((item) => [
            item.phone || "-",
            item.campaign_name || "-",
            item.reason || "Unknown error",
            formatDate(item.createdAt),
          ])}
        />
      )}

      {reportType === "templates" && (
        <ReportTable
          title="Template Health Report"
          actionLabel="Export Summary"
          onAction={exportSummary}
          headers={["Template", "Category", "Language", "Meta Status", "Quality", "Last Synced"]}
          rows={templates.map((template) => [
            template.name || template.metaTemplateName || "-",
            template.category || "-",
            template.language || "-",
            template.metaStatus || "DRAFT",
            template.metaQuality || "-",
            formatDate(template.lastSyncedAt || template.updatedAt),
          ])}
          footer={`Approval rate: ${formatPercent(templateApprovalRate)}`}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, sub, icon, danger = false }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTop}>
        <div>
          <p style={styles.statLabel}>{title}</p>
          <h2 style={styles.statValue}>{value}</h2>
        </div>
        <div style={{ ...styles.statIcon, ...(danger ? styles.statIconDanger : {}) }}>{icon}</div>
      </div>
      <p style={styles.statSub}>{sub}</p>
    </div>
  );
}

function ReportTable({ title, actionLabel, onAction, headers, rows, footer }) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        <button style={styles.linkButton} onClick={onAction}>
          <FaDownload />
          {actionLabel}
        </button>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} style={styles.th}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} style={styles.td}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td style={styles.emptyCell} colSpan={headers.length}>No report data found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {footer ? <div style={styles.footerNote}>{footer}</div> : null}
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#f8fafc",
    fontFamily: "Inter, Arial, sans-serif",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
    fontSize: "18px",
    fontWeight: 700,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "30px",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    borderRadius: "8px",
    padding: "11px 15px",
    background: "linear-gradient(135deg,#16a34a,#0f766e)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "11px 15px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  notice: {
    marginBottom: "16px",
    borderRadius: "8px",
    padding: "12px 14px",
    fontWeight: 700,
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
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  segmented: {
    display: "flex",
    gap: "6px",
    padding: "5px",
    background: "#e2e8f0",
    borderRadius: "8px",
    flexWrap: "wrap",
  },
  segmentButton: {
    border: 0,
    borderRadius: "7px",
    padding: "9px 13px",
    background: "transparent",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 800,
  },
  segmentButtonActive: {
    background: "#fff",
    color: "#0f172a",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
  },
  select: {
    minHeight: "42px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "0 12px",
    background: "#fff",
    color: "#0f172a",
  },
  search: {
    minHeight: "42px",
    minWidth: "260px",
    flex: "1 1 280px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "0 13px",
    background: "#fff",
    color: "#0f172a",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "16px",
    marginBottom: "18px",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "18px",
    boxShadow: "0 8px 26px rgba(15,23,42,0.06)",
  },
  statTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
  },
  statValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: "28px",
  },
  statIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dcfce7",
    color: "#15803d",
  },
  statIconDanger: {
    background: "#fee2e2",
    color: "#dc2626",
  },
  statSub: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.9fr)",
    gap: "18px",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 8px 26px rgba(15,23,42,0.06)",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "18px",
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    padding: "9px 12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    cursor: "pointer",
    fontWeight: 800,
  },
  badge: {
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },
  funnel: {
    display: "grid",
    gap: "16px",
  },
  funnelRow: {
    display: "grid",
    gap: "8px",
  },
  funnelLabel: {
    display: "flex",
    justifyContent: "space-between",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 700,
  },
  progressBg: {
    height: "12px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
  },
  chart: {
    height: "240px",
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    overflowX: "auto",
    paddingTop: "10px",
  },
  barWrap: {
    minWidth: "66px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
  },
  barValue: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#334155",
  },
  bar: {
    width: "34px",
    minHeight: "8px",
    borderRadius: "8px 8px 0 0",
    background: "linear-gradient(180deg,#22c55e,#2563eb)",
  },
  barLabel: {
    maxWidth: "72px",
    color: "#64748b",
    fontSize: "11px",
    textAlign: "center",
  },
  empty: {
    padding: "36px 12px",
    textAlign: "center",
    color: "#64748b",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: "780px",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "13px 12px",
    background: "#f8fafc",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "13px",
  },
  td: {
    padding: "13px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontSize: "14px",
    verticalAlign: "top",
  },
  emptyCell: {
    padding: "30px 12px",
    textAlign: "center",
    color: "#64748b",
  },
  footerNote: {
    marginTop: "14px",
    color: "#334155",
    fontWeight: 800,
  },
};

export default Reports;
