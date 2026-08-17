"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, UtensilsCrossed } from "lucide-react";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "../components/I18nProvider";
import { ApiError, api, getToken, setToken } from "../lib/api";
import { UserProfile } from "../lib/types";

interface AuthResponse {
  access_token: string;
  user: UserProfile;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const body = { email: email.trim().toLowerCase() };

    try {
      let session: AuthResponse;
      try {
        session = await api<AuthResponse>("/auth/login", {
          method: "POST",
          json: body,
          anonymous: true,
        });
      } catch (caught) {
        // Compte inexistant : première connexion, on l'inscrit.
        if (caught instanceof ApiError && caught.status === 404) {
          session = await api<AuthResponse>("/auth/register", {
            method: "POST",
            json: body,
            anonymous: true,
          });
        } else {
          throw caught;
        }
      }

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
      <div className="login__aside">
        <div className="login__lang">
          <LanguageSwitcher tone="dark" />
        </div>
        <div className="login__aside-inner">
          <div className="login__logo">
            <span className="nav__brand-mark">
              <img
                src="/logo.png"
                alt="Cook'It"
                width={30}
                height={30}
                style={{ objectFit: "contain", borderRadius: 6 }}
              />
            </span>
            <h1 className="login__title">{t("app.title")}</h1>
          </div>
          <p className="nav__brand-sub">Cook'It</p>
          <div className="login__rule" />
          <p className="login__baseline">{t("login.tagline")}</p>
        </div>
      </div>

      <div className="login__main">
        <div className="card card--pad login__card">
          <h2 style={{ marginBottom: 20 }}>{t("login.heading")}</h2>

          <form className="form" onSubmit={submit}>
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

            <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>

          <p className="field__hint" style={{ marginTop: 16 }}>
            {t("login.email_hint")}
          </p>
        </div>
      </div>
    </div>
  );
}
