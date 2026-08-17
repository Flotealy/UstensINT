"use client";

import { useState } from "react";
import { AlertCircle, Download, LogOut, Trash2 } from "lucide-react";
import Modal from "../../components/Modal";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useTranslation } from "../../components/I18nProvider";
import { useSession } from "../../components/SessionProvider";
import { api, clearToken } from "../../lib/api";
import { formatDate, initials } from "../../lib/format";

export default function AccountPage() {
  const { t, locale } = useTranslation();
  const { user, logout } = useSession();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const exportData = async () => {
    setError("");
    try {
      const data = await api<unknown>("/users/me/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "ustensint-mes-donnees.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
    }
  };

  const deleteAccount = async () => {
    setWorking(true);
    setError("");
    try {
      await api("/users/me", { method: "DELETE" });
      clearToken();
      window.location.assign("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
      setWorking(false);
    }
  };

  if (!user) return null;

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("account.title")}</h1>
          <p className="page-head__sub">{t("account.subtitle")}</p>
        </div>
      </div>

      <section className="card card--pad stack">
        <div className="inline">
          <span className="nav__avatar" style={{ background: "var(--surface-tint)", width: 48, height: 48 }}>
            {initials(user.display_name)}
          </span>
          <div>
            <h2>{user.display_name}</h2>
            <p className="muted">{t(`roles.${user.role}`)}</p>
          </div>
        </div>

        <hr className="divider" />

        <div className="kv-grid">
          <div className="kv">
            <span className="kv__k">{t("account.email")}</span>
            <span className="kv__v">{user.email}</span>
          </div>
          <div className="kv">
            <span className="kv__k">{t("account.member_since")}</span>
            <span className="kv__v">{formatDate(user.created_at, locale)}</span>
          </div>
          <div className="kv">
            <span className="kv__k">{t("account.name")}</span>
            <span className="kv__v">{user.display_name}</span>
            <span className="field__hint">{t("account.name_hint")}</span>
          </div>
        </div>
      </section>

      <section className="card card--pad stack">
        <h2>{t("account.language")}</h2>
        <LanguageSwitcher />
      </section>

      <section className="card card--pad stack">
        <h2>{t("account.data_title")}</h2>

        <div className="stack stack--sm">
          <button type="button" className="btn btn--ghost" style={{ alignSelf: "flex-start" }} onClick={exportData}>
            <Download size={18} />
            {t("account.export")}
          </button>
          <p className="field__hint">{t("account.export_hint")}</p>
        </div>

        <hr className="divider" />

        <div className="stack stack--sm">
          <button
            type="button"
            className="btn btn--danger-soft"
            style={{ alignSelf: "flex-start" }}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={18} />
            {t("account.delete")}
          </button>
          <p className="field__hint">{t("account.delete_hint")}</p>
        </div>

        {error && (
          <p className="alert alert--error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </p>
        )}
      </section>

      <section className="card card--pad">
        <button type="button" className="btn btn--ghost" onClick={logout}>
          <LogOut size={18} />
          {t("app.logout")}
        </button>
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("account.delete_title")}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmOpen(false)}>
              {t("app.cancel")}
            </button>
            <button type="button" className="btn btn--danger" disabled={working} onClick={deleteAccount}>
              {t("account.delete_confirm")}
            </button>
          </>
        }
      >
        <div className="dialog__body">
          <p>{t("account.delete_text")}</p>
        </div>
      </Modal>
    </main>
  );
}
