"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, KeyRound, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "../components/I18nProvider";
import { ApiError, api, getToken, setToken } from "../lib/api";
import { UserProfile } from "../lib/types";

interface AuthResponse {
  access_token: string;
  user: UserProfile;
}

interface SendCodeResponse {
  message: string;
  email: string;
  expires_in_seconds: number;
  cooldown_seconds: number;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // État du flux : "email" ou "code"
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [successInfo, setSuccessInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Rediriger si déjà connecté
  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  // Compte à rebours pour le renvoi du code
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Étape 1 : Demande d'envoi de code OTP
  const handleSendCode = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setError("");
    setSuccessInfo("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (cleanEmail.includes("+")) {
      setError(t("login.error_plus_not_allowed"));
      return;
    }

    setLoading(true);

    try {
      const res = await api<SendCodeResponse>("/auth/send-code", {
        method: "POST",
        json: { email: cleanEmail },
        anonymous: true,
      });

      setStep("code");
      setCooldown(res.cooldown_seconds || 60);
      setSuccessInfo(res.message || t("login.code_sent_to"));
      setCode("");
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 0
          ? t("app.error_network")
          : caught instanceof Error
            ? caught.message
            : t("app.error_generic"),
      );
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : Vérification du code OTP
  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessInfo("");

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError(t("login.error_invalid_code"));
      return;
    }

    setLoading(true);

    try {
      const session = await api<AuthResponse>("/auth/verify-code", {
        method: "POST",
        json: {
          email: email.trim().toLowerCase(),
          code: cleanCode,
        },
        anonymous: true,
      });

      setToken(session.access_token);
      router.replace("/");
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 0
          ? t("app.error_network")
          : caught instanceof Error
            ? caught.message
            : t("app.error_generic"),
      );
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__lang">
        <LanguageSwitcher />
      </div>

      <div className="login__main">
        <header className="login__hero">
          <img className="login__logo" src="/logo.png" alt="Cook'It" />
          <h1 className="login__title">Ustens&rsquo;INT</h1>
          <div className="login__rule" />
          <p className="login__baseline">{t("login.tagline")}</p>
        </header>

        <div className="card card--pad login__card">
          {step === "email" ? (
            /* --- ÉTAPE 1 : Saisie Email --- */
            <>
              <h2 style={{ marginBottom: 20 }}>{t("login.heading")}</h2>

              <form className="form" onSubmit={handleSendCode}>
                <label className="field">
                  <span className="field__label">{t("login.email_label")}</span>
                  <input
                    type="email"
                    className="input"
                    required
                    autoFocus
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    placeholder={t("login.email_placeholder")}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                {error && (
                  <p className="alert alert--error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={loading || !email.trim()}
                >
                  <Mail size={18} />
                  <span>{loading ? t("login.submitting") : t("login.submit")}</span>
                </button>
              </form>

              <p className="field__hint" style={{ marginTop: 16 }}>
                {t("login.email_hint")}
              </p>
            </>
          ) : (
            /* --- ÉTAPE 2 : Saisie Code OTP (6 caractères alphanumériques) --- */
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>{t("login.code_heading")}</h2>
                <button
                  type="button"
                  className="btn btn--subtle"
                  style={{ padding: "6px 10px", fontSize: 13 }}
                  onClick={() => {
                    setStep("email");
                    setError("");
                    setSuccessInfo("");
                  }}
                >
                  <ArrowLeft size={15} />
                  <span>{t("login.change_email")}</span>
                </button>
              </div>

              <div
                style={{
                  background: "var(--surface-sunken, rgba(0,0,0,0.04))",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13.5,
                  color: "var(--text-muted)",
                  marginBottom: 18,
                  wordBreak: "break-all",
                }}
              >
                <span>{t("login.code_sent_to")} </span>
                <strong style={{ color: "var(--text-strong, #fff)" }}>{email}</strong>
              </div>

              {successInfo && (
                <p className="alert alert--success" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={18} />
                  <span>{successInfo}</span>
                </p>
              )}

              <form className="form" onSubmit={handleVerifyCode}>
                <label className="field">
                  <span className="field__label">{t("login.code_label")}</span>
                  <input
                    type="text"
                    className="input"
                    required
                    autoFocus
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={code}
                    placeholder={t("login.code_placeholder")}
                    style={{
                      fontFamily: "monospace",
                      fontSize: "1.45rem",
                      fontWeight: 700,
                      letterSpacing: "6px",
                      textAlign: "center",
                      textTransform: "uppercase",
                    }}
                    onChange={(event) => {
                      // Nettoyer en majuscules sans espaces
                      const val = event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                      setCode(val);
                    }}
                  />
                </label>

                {error && (
                  <p className="alert alert--error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={loading || code.trim().length !== 6}
                >
                  <KeyRound size={18} />
                  <span>{loading ? t("login.verifying") : t("login.verify_submit")}</span>
                </button>
              </form>

              <div style={{ marginTop: 20, textAlign: "center" }}>
                <button
                  type="button"
                  className="btn btn--subtle"
                  style={{ fontSize: 13.5 }}
                  disabled={loading || cooldown > 0}
                  onClick={() => handleSendCode()}
                >
                  <RefreshCw size={15} className={loading ? "spin" : ""} />
                  <span>
                    {cooldown > 0
                      ? t("login.resend_wait", { seconds: cooldown })
                      : t("login.resend_code")}
                  </span>
                </button>
              </div>

              <p className="field__hint" style={{ marginTop: 14, textAlign: "center" }}>
                {t("login.code_hint")}
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="footer login__footer">
        <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        <span className="footer__links">
          <Link href="/mentions-legales">{t("footer.legal")}</Link>
          <Link href="/politique-de-confidentialite">{t("footer.privacy")}</Link>
        </span>
      </footer>
    </div>
  );
}
