"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, KeyRound, Mail, RefreshCw } from "lucide-react";
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

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError(t("login.error_invalid_code"));
      return;
    }

    setLoading(true);

    try {
      const res = await api<AuthResponse>("/auth/verify-code", {
        method: "POST",
        json: {
          email: email.trim().toLowerCase(),
          code: cleanCode,
        },
        anonymous: true,
      });

      setToken(res.access_token);
      router.replace("/");
      router.refresh();
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

  return (
    <div className="login">
      <div className="login__lang">
        <LanguageSwitcher />
      </div>

      <div className="login__main">
        <header className="login__hero">
          <img
            className="login__logo"
            src="/logo.png"
            alt="Cook'It"
            width={44}
            height={44}
          />
          <h1 className="login__title">Ustens&rsquo;INT</h1>
          <p className="login__baseline">{t("login.tagline")}</p>
        </header>

        <div className="card card--pad login__card">
          {step === "email" ? (
            /* --- ÉTAPE 1 : Saisie Email --- */
            <>
              <h2 style={{ marginBottom: 14, fontSize: "1.25rem" }}>{t("login.heading")}</h2>

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
                  <p className="alert alert--error" style={{ margin: "4px 0" }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={loading || !email.trim()}
                  style={{ marginTop: 6 }}
                >
                  <Mail size={17} />
                  <span>{loading ? t("login.submitting") : t("login.submit")}</span>
                </button>
              </form>

              <p className="field__hint" style={{ marginTop: 12, textAlign: "center", fontSize: 12 }}>
                {t("login.email_hint")}
              </p>
            </>
          ) : (
            /* --- ÉTAPE 2 : Saisie Code OTP (6 caractères) --- */
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{t("login.code_heading")}</h2>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ padding: "3px 8px", fontSize: 12 }}
                  onClick={() => {
                    setStep("email");
                    setError("");
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>{t("login.change_email")}</span>
                </button>
              </div>

              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px 0", lineHeight: 1.35 }}>
                {t("login.code_sent_to")}{" "}
                <strong style={{ color: "var(--ink-strong)", wordBreak: "break-all" }}>{email}</strong>
              </p>

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
                    placeholder="EX: K7M2X9"
                    style={{
                      fontFamily: "monospace",
                      fontSize: "1.35rem",
                      fontWeight: 700,
                      letterSpacing: "5px",
                      textAlign: "center",
                      textTransform: "uppercase",
                      height: 44,
                    }}
                    onChange={(event) => {
                      const val = event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                      setCode(val);
                    }}
                  />
                </label>

                {error && (
                  <p className="alert alert--error" style={{ margin: "4px 0" }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={loading || code.trim().length !== 6}
                  style={{ marginTop: 6 }}
                >
                  <KeyRound size={17} />
                  <span>{loading ? t("login.verifying") : t("login.verify_submit")}</span>
                </button>
              </form>

              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ fontSize: 12.5, padding: "4px 8px" }}
                  disabled={loading || cooldown > 0}
                  onClick={() => handleSendCode()}
                >
                  <RefreshCw size={13} className={loading ? "spin" : ""} />
                  <span>
                    {cooldown > 0
                      ? t("login.resend_wait", { seconds: cooldown })
                      : t("login.resend_code")}
                  </span>
                </button>
              </div>

              <p className="field__hint" style={{ marginTop: 8, textAlign: "center", fontSize: 11.5 }}>
                {t("login.code_hint")}
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="login__footer">
        <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        <span className="footer__links">
          <Link href="/mentions-legales">{t("footer.legal")}</Link>
          <Link href="/politique-de-confidentialite">{t("footer.privacy")}</Link>
        </span>
      </footer>
    </div>
  );
}
