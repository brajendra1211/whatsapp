import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaCheckCircle,
  FaCopy,
  FaExclamationTriangle,
  FaFacebook,
  FaRedo,
  FaSave,
  FaWhatsapp,
} from "react-icons/fa";
import API from "../services/api";

const loadFacebookSdk = (appId, apiVersion) =>
  new Promise((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: apiVersion,
      });
      resolve(window.FB);
    };

    const existing = document.getElementById("facebook-jssdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.FB), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Facebook SDK")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(script);
  });

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const extractSignupSession = (payload = {}) => {
  const parsedPayload = parseMaybeJson(payload) || {};
  const parsedData = parseMaybeJson(parsedPayload.data) || {};
  const nestedData = parseMaybeJson(parsedData.data) || {};

  return {
    ...parsedPayload,
    ...parsedData,
    ...nestedData,
  };
};

const waitForSignupSession = async (sessionRef, attempts = 12) => {
  for (let i = 0; i < attempts; i += 1) {
    const session = sessionRef.current || {};
    const wabaId =
      session.waba_id ||
      session.wabaId ||
      session.whatsapp_business_account_id ||
      session.whatsappBusinessAccountId ||
      "";
    const phoneNumberId =
      session.phone_number_id ||
      session.phoneNumberId ||
      session.phone_number ||
      session.phoneNumber ||
      "";

    if (wabaId && phoneNumberId) {
      return { ...session, wabaId, phoneNumberId };
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return sessionRef.current || {};
};

function WhatsAppSetup() {
  const [config, setConfig] = useState({
    appId: "",
    configId: "",
    apiVersion: "v21.0",
    webhookCallbackUrl: "",
    inboxWebhookCallbackUrl: "",
    hasWebhookVerifyToken: false,
    hasMetaAppSecret: false,
  });
  const [metaForm, setMetaForm] = useState({
    appId: "",
    configId: "",
    appSecret: "",
  });
  const [status, setStatus] = useState({ connected: false, connection: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingMetaConfig, setSavingMetaConfig] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");
  const [notice, setNotice] = useState({ type: "", text: "" });
  const sessionInfoRef = useRef({});

  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice({ type: "", text: "" }), 6000);
  };

  const loadSetup = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, statusRes] = await Promise.all([
        API.get("/whatsapp-setup/config"),
        API.get("/whatsapp-setup/status"),
      ]);

      const setupConfig = configRes.data || {};
      setConfig(setupConfig);
      setMetaForm({
        appId: setupConfig.appId || "",
        configId: setupConfig.configId || "",
        appSecret: "",
      });
      setStatus(statusRes.data || { connected: false, connection: null });
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to load WhatsApp setup");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) {
        return;
      }

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          const session = extractSignupSession(data);
          sessionInfoRef.current = {
            ...(sessionInfoRef.current || {}),
            ...session,
          };
        }
      } catch {
        // Facebook also sends non-JSON messages during the popup lifecycle.
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const connectWithFacebook = async () => {
    if (!config.appId || !config.configId || !config.hasMetaAppSecret) {
      showNotice(
        "error",
        "Meta App Configuration save karo: App ID, Config ID, aur App Secret required hain."
      );
      return;
    }

    try {
      setConnecting(true);
      sessionInfoRef.current = {};

      const FB = await loadFacebookSdk(config.appId, config.apiVersion || "v21.0");

      const handleFacebookLoginResponse = async (response) => {
        try {
          const code = response?.authResponse?.code;
          const session = await waitForSignupSession(sessionInfoRef);

          if (!code) {
            showNotice("error", "Facebook login did not return an auth code");
            setConnecting(false);
            return;
          }

          const wabaId =
            session.waba_id ||
            session.wabaId ||
            session.whatsapp_business_account_id ||
            session.whatsappBusinessAccountId ||
            "";
          const phoneNumberId =
            session.phone_number_id ||
            session.phoneNumberId ||
            session.phone_number ||
            session.phoneNumber ||
            "";

          if (!wabaId || !phoneNumberId) {
            showNotice(
              "error",
              "WABA ID or phone number ID was not received. Please complete the full WhatsApp setup popup."
            );
            setConnecting(false);
            return;
          }

          const res = await API.post("/whatsapp-setup/connect", {
            code,
            waba_id: wabaId,
            phone_number_id: phoneNumberId,
            business_id: session.business_id || session.businessId || "",
            session,
          });

          setStatus({
            connected: true,
            connection: res.data?.connection,
          });
          showNotice("success", res.data?.message || "WhatsApp connected successfully");
        } catch (error) {
          showNotice(
            "error",
            error?.response?.data?.message || error.message || "WhatsApp setup failed"
          );
        } finally {
          setConnecting(false);
        }
      };

      FB.login(
        (response) => {
          handleFacebookLoginResponse(response);
        },
        {
          config_id: config.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: "3",
          },
        }
      );
    } catch (error) {
      setConnecting(false);
      showNotice("error", error.message || "Failed to start Facebook setup");
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotice("success", `${label} copied`);
    } catch {
      showNotice("error", `Could not copy ${label.toLowerCase()}`);
    }
  };

  const saveMetaConfiguration = async () => {
    const payload = {
      appId: metaForm.appId.trim(),
      configId: metaForm.configId.trim(),
    };

    if (!payload.appId || !payload.configId) {
      showNotice("error", "Meta App ID and Embedded Signup Config ID are required");
      return;
    }

    if (metaForm.appSecret.trim()) {
      payload.appSecret = metaForm.appSecret.trim();
    } else if (!config.hasMetaAppSecret) {
      showNotice("error", "Meta App Secret is required");
      return;
    }

    try {
      setSavingMetaConfig(true);
      const res = await API.post("/whatsapp-setup/meta-app-config", payload);

      setConfig((current) => ({
        ...current,
        appId: res.data?.appId || payload.appId,
        configId: res.data?.configId || payload.configId,
        apiVersion: res.data?.apiVersion || current.apiVersion,
        hasMetaAppSecret: Boolean(res.data?.hasMetaAppSecret),
        metaAppConfigSource: res.data?.metaAppConfigSource || current.metaAppConfigSource,
      }));
      setMetaForm((current) => ({
        ...current,
        appId: res.data?.appId || payload.appId,
        configId: res.data?.configId || payload.configId,
        appSecret: "",
      }));
      showNotice("success", res.data?.message || "Meta app configuration saved");
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to save Meta app config");
    } finally {
      setSavingMetaConfig(false);
    }
  };

  const saveWebhookToken = async () => {
    if (!webhookToken.trim()) {
      showNotice("error", "Verify token is required");
      return;
    }

    try {
      setSavingWebhook(true);
      const res = await API.post("/whatsapp-setup/webhook-config", {
        verifyToken: webhookToken.trim(),
      });

      setConfig((current) => ({
        ...current,
        webhookCallbackUrl: res.data?.webhookCallbackUrl || current.webhookCallbackUrl,
        inboxWebhookCallbackUrl: res.data?.inboxWebhookCallbackUrl || current.inboxWebhookCallbackUrl,
        hasWebhookVerifyToken: true,
      }));
      showNotice("success", res.data?.message || "Webhook verify token saved");
    } catch (error) {
      showNotice("error", error?.response?.data?.message || "Failed to save webhook token");
    } finally {
      setSavingWebhook(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading WhatsApp setup...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>WhatsApp Setup</h1>
          <p style={styles.subtitle}>
            Connect a Meta WhatsApp Business account using Facebook Embedded Signup.
          </p>
        </div>

        <button style={styles.secondaryButton} onClick={loadSetup}>
          <FaRedo />
          Refresh
        </button>
      </div>

      {notice.text ? (
        <div style={{ ...styles.notice, ...(notice.type === "success" ? styles.noticeSuccess : styles.noticeError) }}>
          {notice.text}
        </div>
      ) : null}

      <section style={styles.hero}>
        <div style={styles.heroIcon}>
          <FaWhatsapp />
        </div>
        <div>
          <h2 style={styles.heroTitle}>
            {status.connected ? "WhatsApp is connected" : "Connect your WhatsApp Business account"}
          </h2>
          <p style={styles.heroText}>
            The popup will let you select/create a Business, WABA, and phone number. After completion this app stores the connected WABA and phone ID for templates and sending.
          </p>
        </div>
      </section>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Meta App Configuration</h3>

          <label style={styles.fieldLabel}>Meta App ID</label>
          <input
            style={styles.input}
            value={metaForm.appId}
            onChange={(event) =>
              setMetaForm((current) => ({ ...current, appId: event.target.value }))
            }
            placeholder="Enter Meta App ID"
          />

          <label style={styles.fieldLabel}>Embedded Signup Config ID</label>
          <input
            style={styles.input}
            value={metaForm.configId}
            onChange={(event) =>
              setMetaForm((current) => ({ ...current, configId: event.target.value }))
            }
            placeholder="Enter Embedded Signup Config ID"
          />

          <label style={styles.fieldLabel}>App Secret</label>
          <input
            style={styles.input}
            type="password"
            value={metaForm.appSecret}
            onChange={(event) =>
              setMetaForm((current) => ({ ...current, appSecret: event.target.value }))
            }
            placeholder={
              config.hasMetaAppSecret
                ? "Secret saved. Leave blank to keep current secret."
                : "Enter Meta App Secret"
            }
            autoComplete="new-password"
          />

          <button style={styles.saveButton} onClick={saveMetaConfiguration} disabled={savingMetaConfig}>
            <FaSave />
            {savingMetaConfig ? "Saving..." : "Save Meta Config"}
          </button>

          <p style={styles.helperText}>
            {config.hasMetaAppSecret
              ? "Meta app config is ready for this login. Connect this company's WABA and phone number from this page."
              : "Save this company's Meta config before using Continue with Facebook."}
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Webhook Verification</h3>

          <label style={styles.fieldLabel}>Callback URL</label>
          <div style={styles.copyField}>
            <input style={styles.readOnlyInput} value={config.webhookCallbackUrl || ""} readOnly />
            <button
              style={styles.iconButton}
              onClick={() => copyText(config.webhookCallbackUrl || "", "Callback URL")}
              disabled={!config.webhookCallbackUrl}
              title="Copy callback URL"
            >
              <FaCopy />
            </button>
          </div>

          <label style={styles.fieldLabel}>Inbox URL Alias</label>
          <div style={styles.copyField}>
            <input style={styles.readOnlyInput} value={config.inboxWebhookCallbackUrl || ""} readOnly />
            <button
              style={styles.iconButton}
              onClick={() => copyText(config.inboxWebhookCallbackUrl || "", "Inbox URL alias")}
              disabled={!config.inboxWebhookCallbackUrl}
              title="Copy inbox URL alias"
            >
              <FaCopy />
            </button>
          </div>

          <label style={styles.fieldLabel}>Verify Token</label>
          <div style={styles.copyField}>
            <input
              style={styles.input}
              value={webhookToken}
              onChange={(event) => setWebhookToken(event.target.value)}
              placeholder={
                config.hasWebhookVerifyToken
                  ? "Token already saved. Enter a new token to change it."
                  : "Enter the same token used in Meta"
              }
            />
            <button
              style={styles.iconButton}
              onClick={() => copyText(webhookToken, "Verify token")}
              disabled={!webhookToken.trim()}
              title="Copy verify token"
            >
              <FaCopy />
            </button>
          </div>

          <button style={styles.saveButton} onClick={saveWebhookToken} disabled={savingWebhook}>
            <FaSave />
            {savingWebhook ? "Saving..." : "Save Verify Token"}
          </button>

          <p style={styles.helperText}>
            {config.hasWebhookVerifyToken
              ? "A verify token is configured for Meta webhook validation."
              : "Add a verify token before validating the callback URL in Meta."}
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Connection Status</h3>

          {status.connected ? (
            <div style={styles.connectedBox}>
              <FaCheckCircle />
              <div>
                <strong>Connected</strong>
                <p>WABA ID: {status.connection?.wabaId || "-"}</p>
                <p>Phone Number ID: {status.connection?.phoneNumberId || "-"}</p>
                <p>Connected at: {status.connection?.connectedAt ? new Date(status.connection.connectedAt).toLocaleString() : "-"}</p>
              </div>
            </div>
          ) : (
            <div style={styles.warningBox}>
              <FaExclamationTriangle />
              <div>
                <strong>Not connected</strong>
                <p>Setup is required before account-specific templates and real WhatsApp sending can use this user's WABA.</p>
              </div>
            </div>
          )}

          <button style={styles.facebookButton} onClick={connectWithFacebook} disabled={connecting}>
            <FaFacebook />
            {connecting ? "Opening Facebook..." : status.connected ? "Reconnect with Facebook" : "Continue with Facebook"}
          </button>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Before You Start</h3>
          <div style={styles.checkList}>
            <p>Facebook Login for Business configuration must use WhatsApp Embedded Signup.</p>
            <p>App needs `whatsapp_business_management` and `whatsapp_business_messaging` access.</p>
            <p>For local testing, use HTTPS tunnel and add that domain in Meta app settings.</p>
            <p>This flow cannot bypass WABA restrictions from Meta.</p>
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
    padding: "24px",
    fontFamily: "Inter, Arial, sans-serif",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
    fontWeight: 700,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px",
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
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    borderRadius: "8px",
    padding: "11px 15px",
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
  hero: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    background: "linear-gradient(135deg,#0f172a,#14532d)",
    color: "#fff",
    borderRadius: "8px",
    padding: "24px",
    marginBottom: "18px",
  },
  heroIcon: {
    width: "58px",
    height: "58px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#22c55e",
    fontSize: "30px",
    flexShrink: 0,
  },
  heroTitle: {
    margin: 0,
    color: "#fff",
    fontSize: "24px",
  },
  heroText: {
    margin: "8px 0 0",
    color: "#dcfce7",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
    gap: "18px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    margin: "0 0 16px",
    color: "#0f172a",
    fontSize: "18px",
  },
  fieldLabel: {
    display: "block",
    margin: "14px 0 6px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 800,
  },
  copyField: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 44px",
    gap: "8px",
    alignItems: "center",
  },
  input: {
    width: "100%",
    minWidth: 0,
    height: "44px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "0 12px",
    color: "#0f172a",
    background: "#fff",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  readOnlyInput: {
    width: "100%",
    minWidth: 0,
    height: "44px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "0 12px",
    color: "#334155",
    background: "#f8fafc",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  iconButton: {
    width: "44px",
    height: "44px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  saveButton: {
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
    fontWeight: 800,
    cursor: "pointer",
    fontSize: "15px",
    marginTop: "16px",
  },
  helperText: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  connectedBox: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    borderRadius: "8px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    lineHeight: 1.6,
    marginBottom: "16px",
  },
  warningBox: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    borderRadius: "8px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    lineHeight: 1.6,
    marginBottom: "16px",
  },
  facebookButton: {
    width: "100%",
    minHeight: "52px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    border: "none",
    borderRadius: "8px",
    background: "#1877f2",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: "15px",
  },
  checkList: {
    display: "grid",
    gap: "12px",
    color: "#475569",
    lineHeight: 1.6,
  },
};

export default WhatsAppSetup;
