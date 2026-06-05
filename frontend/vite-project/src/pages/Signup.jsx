import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiShield,
  FiSmartphone,
  FiUser,
} from "react-icons/fi";
import API from "../services/api";
import "./Auth.css";

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

const getPasswordChecks = (password) => [
  { label: "8+ characters", met: password.length >= 8 },
  { label: "Uppercase letter", met: /[A-Z]/.test(password) },
  { label: "Number", met: /\d/.test(password) },
  { label: "Special symbol", met: /[^A-Za-z0-9]/.test(password) },
];

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const strength = passwordChecks.filter((item) => item.met).length;
  const strengthLabel = ["Weak", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["#ef4444", "#ef4444", "#f59e0b", "#2563eb", "#16a34a"][strength];

  const formReady = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      isValidEmail(email.trim()) &&
      strength >= 3 &&
      password === confirmPassword
    );
  }, [name, email, strength, password, confirmPassword]);

  const signup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (strength < 3) {
      setError("Please choose a stronger password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await API.post("/auth/signup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setSuccess("Account created successfully. Redirecting to login...");
      setTimeout(() => navigate("/"), 900);
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Please try again.");
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
          <h1>Create your messaging workspace.</h1>
          <p>
            Set up a secure account for contact imports, Meta templates, campaign reporting, and inbox operations.
          </p>
        </div>

        <div className="auth-proof-grid">
          <div className="auth-proof">
            <strong>Fast</strong>
            <span>Start campaigns quickly</span>
          </div>
          <div className="auth-proof">
            <strong>Clean</strong>
            <span>Organized admin flows</span>
          </div>
          <div className="auth-proof">
            <strong>Ready</strong>
            <span>Built for operations teams</span>
          </div>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-panel-header">
            <div className="auth-kicker">
              <FiShield />
              Team access
            </div>
            <h2>Create account</h2>
            <p>Use a strong password to protect campaign data and customer conversations.</p>
          </div>

          <form className="auth-form" onSubmit={signup} noValidate>
            <div className="auth-field">
              <label htmlFor="name">Full name</label>
              <div className="auth-input-wrap">
                <FiUser />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Admin User"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  placeholder="Create a strong password"
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

            <div className="auth-strength" aria-live="polite">
              <div className="auth-strength-track">
                <div
                  className="auth-strength-bar"
                  style={{ width: `${Math.max(strength, 1) * 25}%`, background: strengthColor }}
                />
              </div>
              <div className="auth-strength-meta">
                <span>Password strength</span>
                <strong style={{ color: strengthColor }}>{strengthLabel}</strong>
              </div>
              <ul className="auth-requirements">
                {passwordChecks.map((item) => (
                  <li key={item.label} className={item.met ? "met" : ""}>
                    {item.met ? <FiCheck /> : <FiCheckCircle />}
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <div className="auth-input-wrap">
                <FiLock />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  className="auth-icon-btn"
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="auth-error" role="alert">
                <FiAlertCircle />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="auth-success" role="status">
                <FiCheckCircle />
                <span>{success}</span>
              </div>
            ) : null}

            <button className="auth-submit" type="submit" disabled={loading || !formReady}>
              {loading ? <span className="auth-spinner" /> : <FiArrowRight />}
              {loading ? "Creating account..." : "Create secure account"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link className="auth-link" to="/">Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Signup;
