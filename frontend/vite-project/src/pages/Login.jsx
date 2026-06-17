import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiShield,
  FiSmartphone,
} from "react-icons/fi";
import API from "../services/api";
import "./Auth.css";

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formReady = useMemo(() => {
    return isValidEmail(email.trim()) && password.length >= 6;
  }, [email, password]);

  const login = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid business email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", res.data.token);
      storage.setItem("user", JSON.stringify(res.data.user || {}));
      if (remember) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="Product overview">
        <div className="auth-brand">
          <span className="auth-brand-icon">
            <FiSmartphone size={22} />
          </span>
          WhatsApp SaaS
        </div>

        <div className="auth-copy">
          <h1>Run campaigns with a cleaner command center.</h1>
          <p>
            Sign in to manage contacts, templates, inbox conversations, and campaign delivery from one focused dashboard.
          </p>
        </div>

        <div className="auth-proof-grid">
          <div className="auth-proof">
            <strong>Secure</strong>
            <span>JWT protected workspace</span>
          </div>
          <div className="auth-proof">
            <strong>Live</strong>
            <span>Campaign and inbox tracking</span>
          </div>
          <div className="auth-proof">
            <strong>Meta</strong>
            <span>Template workflow ready</span>
          </div>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-panel-header">
            <div className="auth-kicker">
              <FiShield />
              Secure login
            </div>
            <h2>Welcome back</h2>
            <p>Use your account email and password to continue to the admin panel.</p>
          </div>

          <form className="auth-form" onSubmit={login} noValidate>
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <div className="auth-input-wrap">
                <FiMail />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <FiLock />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="auth-icon-btn"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="auth-row">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Keep me signed in
              </label>
              <span>Protected session</span>
            </div>

            {error ? (
              <div className="auth-error" role="alert">
                <FiAlertCircle />
                <span>{error}</span>
              </div>
            ) : null}

            <button className="auth-submit" type="submit" disabled={loading || !formReady}>
              {loading ? <span className="auth-spinner" /> : <FiArrowRight />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="auth-footer">
            New to WhatsApp SaaS? <Link className="auth-link" to="/signup">Create account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
