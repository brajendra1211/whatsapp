import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaBell, FaBolt, FaSearch, FaTimes } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { navItems, quickActions, routeMeta } from "../config/navigation.jsx";

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 992);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setPaletteOpen(false);
    setQuery("");
  }, [location.pathname]);

  const meta = routeMeta[location.pathname] || {
    title: "Admin Panel",
    subtitle: "Manage WhatsApp operations from one workspace.",
  };

  const filteredItems = navItems.filter((item) => {
    const text = `${item.label} ${item.subtitle}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const goTo = (path) => {
    navigate(path);
    setPaletteOpen(false);
    setQuery("");
  };

  return (
    <div style={styles.wrapper}>
      <Sidebar />

      <main
        style={{
          ...styles.content,
          marginLeft: isMobile ? "0" : "236px",
          paddingTop: isMobile ? "72px" : "0",
        }}
      >
        <header style={styles.topbar}>
          <div style={styles.topbarTitle}>
            <span style={styles.currentPage}>{meta.title}</span>
            <span style={styles.currentSubtitle}>{meta.subtitle}</span>
          </div>

          <div style={styles.topActions}>
            <button style={styles.searchButton} onClick={() => setPaletteOpen(true)}>
              <FaSearch />
              <span>Search or jump</span>
            </button>

            <button style={styles.iconButton} title="Quick actions" onClick={() => setPaletteOpen(true)}>
              <FaBolt />
            </button>

            <button style={styles.iconButton} title="Notifications">
              <FaBell />
            </button>
          </div>
        </header>

        <section style={styles.pageSurface}>
          <Outlet />
        </section>
      </main>

      {paletteOpen ? (
        <div style={styles.paletteOverlay} onMouseDown={() => setPaletteOpen(false)}>
          <div style={styles.palette} onMouseDown={(event) => event.stopPropagation()}>
            <div style={styles.paletteSearchRow}>
              <FaSearch />
              <input
                autoFocus
                style={styles.paletteInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages and actions"
              />
              <button style={styles.paletteClose} onClick={() => setPaletteOpen(false)}>
                <FaTimes />
              </button>
            </div>

            <div style={styles.paletteBody}>
              <div style={styles.paletteSectionTitle}>Pages</div>
              <div style={styles.paletteList}>
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <button key={item.to} style={styles.paletteItem} onClick={() => goTo(item.to)}>
                      <span style={styles.paletteIcon}>{item.icon}</span>
                      <span style={styles.paletteText}>
                        <strong>{item.label}</strong>
                        <span>{item.subtitle}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div style={styles.emptyPalette}>No matching page</div>
                )}
              </div>

              {!query.trim() ? (
                <>
                  <div style={styles.paletteSectionTitle}>Quick Actions</div>
                  <div style={styles.paletteList}>
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        style={styles.paletteItem}
                        onClick={() => goTo(action.to)}
                      >
                        <span style={styles.paletteIcon}>{action.icon}</span>
                        <span style={styles.paletteText}>
                          <strong>{action.label}</strong>
                          <span>{action.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#f8fafc",
  },

  content: {
    minHeight: "100vh",
    padding: "0 18px 24px",
    boxSizing: "border-box",
    transition: "margin-left 0.3s ease",
    background: "#f8fafc",
  },

  topbar: {
    minHeight: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    padding: "0 4px",
    borderBottom: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },

  topbarTitle: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
  },

  currentPage: {
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: 800,
  },

  currentSubtitle: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "520px",
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  searchButton: {
    height: "38px",
    minWidth: "190px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#475569",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 13px",
    cursor: "pointer",
    fontWeight: 700,
  },

  iconButton: {
    width: "38px",
    height: "38px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  pageSurface: {
    minWidth: 0,
  },

  paletteOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.52)",
    zIndex: 2000,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "72px 16px 24px",
  },

  palette: {
    width: "min(680px, 100%)",
    maxHeight: "min(720px, calc(100vh - 120px))",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 30px 80px rgba(15,23,42,0.28)",
    overflow: "hidden",
  },

  paletteSearchRow: {
    height: "58px",
    display: "grid",
    gridTemplateColumns: "22px minmax(0,1fr) 38px",
    alignItems: "center",
    gap: "10px",
    padding: "0 14px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
  },

  paletteInput: {
    width: "100%",
    border: "none",
    outline: "none",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: "15px",
  },

  paletteClose: {
    width: "36px",
    height: "36px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#f8fafc",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  paletteBody: {
    padding: "14px",
    maxHeight: "calc(100vh - 190px)",
    overflowY: "auto",
  },

  paletteSectionTitle: {
    margin: "8px 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },

  paletteList: {
    display: "grid",
    gap: "8px",
    marginBottom: "16px",
  },

  paletteItem: {
    minHeight: "58px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#fff",
    display: "grid",
    gridTemplateColumns: "40px minmax(0,1fr)",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    cursor: "pointer",
    textAlign: "left",
  },

  paletteIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    background: "#f1f5f9",
    color: "#16a34a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  paletteText: {
    display: "grid",
    gap: "3px",
    minWidth: 0,
    color: "#0f172a",
  },

  emptyPalette: {
    padding: "18px",
    color: "#64748b",
    textAlign: "center",
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
  },
};

export default MainLayout;
