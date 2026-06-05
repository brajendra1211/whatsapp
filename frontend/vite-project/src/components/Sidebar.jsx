import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import { navigationSections } from "../config/navigation.jsx";

function Sidebar() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);
  const [isOpen, setIsOpen] = useState(window.innerWidth > 992);
  const [user, setUser] = useState({ name: "Admin User", email: "admin@company.com" });

  useEffect(() => {
    const handleResize = () => {
      const mobileView = window.innerWidth <= 992;
      setIsMobile(mobileView);
      setIsOpen(!mobileView);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");

    if (!storedUser) return;

    try {
      const parsed = JSON.parse(storedUser);
      setUser({
        name: parsed?.name || parsed?.email || "Admin User",
        email: parsed?.email || "admin@company.com",
      });
    } catch {
      setUser({ name: "Admin User", email: "admin@company.com" });
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/");
  };

  const initials = String(user.name || user.email || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {isMobile && (
        <button
          onClick={() => setIsOpen(true)}
          style={styles.mobileMenuBtn}
          aria-label="Open menu"
        >
          <FaBars />
        </button>
      )}

      {isMobile && isOpen && (
        <div style={styles.overlay} onClick={() => setIsOpen(false)} />
      )}

      <aside
        style={{
          ...styles.sidebar,
          ...(isMobile
            ? {
                transform: isOpen ? "translateX(0)" : "translateX(-100%)",
                boxShadow: isOpen ? "0 20px 60px rgba(0,0,0,0.35)" : "none",
              }
            : {
                transform: "translateX(0)",
              }),
        }}
      >
        <div>
          <div style={styles.topSection}>
            <div style={styles.brandWrap}>
              <div style={styles.logoRow}>
                <div style={styles.logoBox}>
                  <FaWhatsapp />
                </div>
                <div>
                  <h2 style={styles.brandTitle}>Navkaar CRM</h2>
                  <p style={styles.brandSub}>WhatsApp Growth Panel</p>
                </div>
              </div>

              {isMobile && (
                <button
                  onClick={() => setIsOpen(false)}
                  style={styles.closeBtn}
                  aria-label="Close menu"
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>

          <nav style={styles.nav}>
            {navigationSections.map((section) => (
              <div key={section.title} style={styles.navSection}>
                <div style={styles.sectionTitle}>{section.title}</div>

                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (isMobile) setIsOpen(false);
                    }}
                    style={({ isActive }) => ({
                      ...styles.link,
                      ...(isActive ? styles.activeLink : {}),
                    })}
                  >
                    <span style={styles.linkIcon}>{item.icon}</span>
                    <span style={styles.linkLabel}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div style={styles.bottomSection}>
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>{initials || "A"}</div>
            <div>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userRole}>{user.email}</div>
            </div>
          </div>

          <button onClick={logout} style={styles.logoutBtn}>
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

const styles = {
  sidebar: {
    width: "236px",
    height: "100vh",
    background: "#0f172a",
    color: "#fff",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 1001,
    transition: "transform 0.3s ease",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    boxSizing: "border-box",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    zIndex: 1000,
  },

  mobileMenuBtn: {
    position: "fixed",
    top: "16px",
    left: "16px",
    width: "42px",
    height: "42px",
    border: "none",
    borderRadius: "8px",
    background: "#111827",
    color: "#fff",
    fontSize: "18px",
    cursor: "pointer",
    zIndex: 1100,
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  },

  closeBtn: {
    width: "38px",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
  },

  topSection: {
    marginBottom: "18px",
  },

  brandWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
  },

  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  logoBox: {
    minWidth: "40px",
    height: "40px",
    borderRadius: "8px",
    background: "#16a34a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    boxShadow: "none",
  },

  brandTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "700",
    color: "#ffffff",
  },

  brandSub: {
    margin: "2px 0 0 0",
    fontSize: "11px",
    color: "#94a3b8",
  },

  sectionTitle: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0",
    color: "#64748b",
    marginBottom: "6px",
    paddingLeft: "6px",
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    paddingBottom: "16px",
    maxHeight: "calc(100vh - 204px)",
    overflowY: "auto",
  },

  navSection: {
    display: "grid",
    gap: "4px",
  },

  link: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 11px",
    textDecoration: "none",
    color: "#cbd5e1",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s ease",
    border: "1px solid transparent",
    background: "transparent",
  },

  activeLink: {
    background: "#16a34a",
    color: "#fff",
    boxShadow: "none",
  },

  linkIcon: {
    width: "18px",
    display: "flex",
    justifyContent: "center",
    fontSize: "16px",
  },

  linkLabel: {
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  bottomSection: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    paddingTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px",
    padding: "10px",
    minWidth: 0,
  },

  userAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "15px",
  },

  userName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "136px",
  },

  userRole: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "136px",
  },

  logoutBtn: {
    width: "100%",
    padding: "11px 12px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    color: "#fff",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: "600",
    fontSize: "14px",
    boxShadow: "none",
  },
};

export default Sidebar;
