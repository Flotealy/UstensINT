"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  MailCheck,
  MessageSquare,
  PackageAlert,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Sliders,
  Users,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { useTranslation } from "../../../components/I18nProvider";
import { ApiError, api } from "../../../lib/api";
import { Setting } from "../../../lib/types";

const LIST_KEYS = [
  "deposit_types",
  "equipment_statuses",
  "blocking_equipment_statuses",
  "allowed_domains",
] as const;

const NUMBER_KEYS = [
  "max_reservation_days",
  "max_advance_days",
  "email_reminder_hours_before",
] as const;

const BOOLEAN_KEYS = [
  "auto_approve_reservations",
  "require_phone",
  "require_comments",
  "email_notifications_enabled",
  "email_notify_new_reservation",
  "email_notify_approval",
  "email_notify_reminder",
  "email_notify_overdue",
  "email_notify_stock_alert",
] as const;

const DEFAULTS: Record<string, string> = {
  max_reservation_days: "14",
  max_advance_days: "0",
  auto_approve_reservations: "false",
  require_phone: "false",
  require_comments: "false",
  deposit_types: '["Liquide","Virement","Chèque"]',
  equipment_statuses: '["Neuf","Bon état","Usé","En réparation","Hors service"]',
  blocking_equipment_statuses: '["En réparation","Hors service"]',
  allowed_domains: '["telecom-sudparis.eu"]',
  discord_webhook_url: "",
  email_notifications_enabled: "true",
  email_notify_new_reservation: "true",
  email_notify_approval: "true",
  email_notify_reminder: "true",
  email_reminder_hours_before: "24",
  email_notify_overdue: "true",
  email_notify_stock_alert: "true",
  email_staff_notification_address: "",
};

type SettingsTab = "rules" | "equipment" | "access" | "notifications";

interface SmtpStatus {
  configured: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_from: string;
  smtp_user: string;
  smtp_tls: boolean;
}

function parseList(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // format hérité
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function serializeList(values: string[]): string {
  return JSON.stringify(values);
}

function ListEditor({
  values,
  label,
  onChange,
}: {
  values: string[];
  label: string;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setDraft("");
  };

  const remove = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {values.length === 0 ? (
        <p className="field__hint">{t("settings.list_empty")}</p>
      ) : (
        <div className="chips">
          {values.map((value, idx) => (
            <span key={value} className="chip chip--neutral">
              <span>{value}</span>
              <button
                type="button"
                className="chip__remove"
                onClick={() => remove(idx)}
                aria-label={t("settings.list_remove", { value })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="inline" style={{ gap: 8 }}>
        <input
          type="text"
          className="input"
          style={{ maxWidth: 280 }}
          value={draft}
          placeholder={t("settings.list_placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={add}
          disabled={!draft.trim() || values.includes(draft.trim())}
          aria-label={t("settings.list_add")}
        >
          <Plus size={16} />
          <span>{t("settings.list_add")}</span>
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<SettingsTab>("rules");
  const [initial, setInitial] = useState<Record<string, string>>(DEFAULTS);
  const [values, setValues] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    api<Setting[]>("/settings")
      .then((items) => {
        const mapped: Record<string, string> = { ...DEFAULTS };
        for (const item of items) {
          mapped[item.key] = item.value;
        }
        setInitial(mapped);
        setValues(mapped);
      })
      .catch((caught) => {
        setError(
          caught instanceof ApiError && caught.status === 0
            ? t("app.error_network")
            : caught instanceof Error
              ? caught.message
              : t("app.error_generic"),
        );
      })
      .finally(() => setLoading(false));

    api<SmtpStatus>("/settings/smtp-status")
      .then(setSmtpStatus)
      .catch(() => {});
  }, [t]);

  const handleSendTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailFeedback(null);
    try {
      const res = await api<{ message: string; target: string }>("/settings/test-email", {
        method: "POST",
      });
      setTestEmailFeedback({ type: "success", message: res.message });
    } catch (err) {
      setTestEmailFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email de test.",
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const dirty = useMemo(() => {
    const changed: string[] = [];
    for (const key of Object.keys(values)) {
      if (values[key] !== initial[key]) {
        changed.push(key);
      }
    }
    return changed;
  }, [values, initial]);

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const setBool = (key: (typeof BOOLEAN_KEYS)[number], next: boolean) => {
    set(key, next ? "true" : "false");
  };

  const setList = (key: (typeof LIST_KEYS)[number], next: string[]) => {
    set(key, serializeList(next));
  };

  const lists = useMemo(() => {
    const parsed: Record<string, string[]> = {};
    for (const key of LIST_KEYS) {
      parsed[key] = parseList(values[key] ?? DEFAULTS[key] ?? "");
    }
    return parsed;
  }, [values]);

  const resetChanges = () => {
    setValues(initial);
    setError("");
  };

  const save = async () => {
    if (dirty.length === 0) return;
    setSaving(true);
    setError("");
    setSavedSuccess(false);

    try {
      for (const key of dirty) {
        await api(`/settings/${key}`, { method: "PATCH", json: { value: values[key] } });
      }
      setInitial({ ...values });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 0
          ? t("app.error_network")
          : caught instanceof Error
            ? caught.message
            : t("app.error_generic"),
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ key: SettingsTab; label: string; icon: typeof Sliders }> = [
    { key: "rules", label: t("settings.tabs.rules"), icon: CalendarCheck },
    { key: "equipment", label: t("settings.tabs.equipment"), icon: Utensils },
    { key: "access", label: t("settings.tabs.access"), icon: Users },
    { key: "notifications", label: t("settings.tabs.notifications"), icon: BellRing },
  ];

  if (loading) {
    return (
      <main className="container page-pad">
        <div className="card card--pad placeholder-box">
          <p className="muted">{t("app.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container page-pad stack stack--lg">
      <div className="page-head">
        <div>
          <h1>{t("settings.title")}</h1>
          <p className="page-head__sub">{t("settings.subtitle")}</p>
        </div>
        {savedSuccess && (
          <div className="chip chip--success" style={{ animation: "fadeIn 0.25s ease" }}>
            <CheckCircle2 size={16} />
            <span>{t("settings.saved")}</span>
          </div>
        )}
      </div>

      {/* Navigation par onglets */}
      <div className="segmented-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`segmented-nav__btn ${isActive ? "segmented-nav__btn--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {/* ===================================================================
            ONGLET 1 : RÈGLES & RÉSERVATIONS
            =================================================================== */}
        {activeTab === "rules" && (
          <div className="stack stack--lg">
            <section className="card card--pad stack">
              <h2>{t("settings.group_rules")}</h2>
              <div className="grid grid--2" style={{ gap: 16 }}>
                {NUMBER_KEYS.filter((k) => k.startsWith("max_")).map((key) => (
                  <label key={key} className="field">
                    <span className="field__label">{t(`settings.${key}`)}</span>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      value={values[key] ?? "0"}
                      onChange={(event) => set(key, event.target.value)}
                    />
                    <span className="field__hint">{t(`settings.${key}_hint`)}</span>
                  </label>
                ))}
              </div>

              <div className="stack" style={{ gap: 12, marginTop: 8 }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={values.auto_approve_reservations === "true"}
                    onChange={(event) => setBool("auto_approve_reservations", event.target.checked)}
                  />
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="strong">{t("settings.auto_approve_reservations")}</span>
                    <p className="field__hint" style={{ margin: 0 }}>
                      {t("settings.auto_approve_reservations_hint")}
                    </p>
                  </div>
                </label>
              </div>
            </section>

            <section className="card card--pad stack">
              <h2>{t("settings.group_form")}</h2>
              <p className="field__hint">{t("settings.group_form_hint")}</p>

              <div className="stack" style={{ gap: 16 }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={values.require_phone === "true"}
                    onChange={(event) => setBool("require_phone", event.target.checked)}
                  />
                  <div className="stack" style={{ gap: 2 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <Phone size={16} className="text-muted" />
                      <span className="strong">{t("settings.require_phone")}</span>
                    </div>
                    <span className="field__hint">{t("settings.require_phone_hint")}</span>
                  </div>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={values.require_comments === "true"}
                    onChange={(event) => setBool("require_comments", event.target.checked)}
                  />
                  <div className="stack" style={{ gap: 2 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <MessageSquare size={16} className="text-muted" />
                      <span className="strong">{t("settings.require_comments")}</span>
                    </div>
                    <span className="field__hint">{t("settings.require_comments_hint")}</span>
                  </div>
                </label>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            ONGLET 2 : MATÉRIEL & CAUTION
            =================================================================== */}
        {activeTab === "equipment" && (
          <div className="stack stack--lg">
            <section className="card card--pad stack">
              <h2>{t("settings.deposit_types")}</h2>
              <div className="field">
                <span className="field__hint">{t("settings.deposit_types_hint")}</span>
                <ListEditor
                  values={lists.deposit_types}
                  label={t("settings.deposit_types")}
                  onChange={(list) => setList("deposit_types", list)}
                />
              </div>
            </section>

            <section className="card card--pad stack">
              <h2>{t("settings.equipment_statuses")}</h2>
              <div className="field">
                <span className="field__hint">{t("settings.equipment_statuses_hint")}</span>
                <ListEditor
                  values={lists.equipment_statuses}
                  label={t("settings.equipment_statuses")}
                  onChange={(list) => setList("equipment_statuses", list)}
                />
              </div>

              <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                <div className="inline" style={{ gap: 6 }}>
                  <ShieldAlert size={16} className="text-accent" />
                  <span className="strong">{t("settings.group_blocking")}</span>
                </div>
                <p className="field__hint">{t("settings.group_blocking_hint")}</p>
                <div className="chips">
                  {lists.equipment_statuses.map((status) => {
                    const isBlocking = lists.blocking_equipment_statuses.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        className={`chip ${isBlocking ? "chip--danger" : "chip--neutral"}`}
                        onClick={() => {
                          const next = isBlocking
                            ? lists.blocking_equipment_statuses.filter((s) => s !== status)
                            : [...lists.blocking_equipment_statuses, status];
                          setList("blocking_equipment_statuses", next);
                        }}
                      >
                        {isBlocking && <Ban size={12} />}
                        <span>{status}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            ONGLET 3 : ACCÈS & INSCRIPTION
            =================================================================== */}
        {activeTab === "access" && (
          <div className="stack stack--lg">
            <section className="card card--pad stack">
              <h2>{t("settings.allowed_domains")}</h2>
              <div className="field">
                <span className="field__hint">{t("settings.allowed_domains_hint")}</span>
                <ListEditor
                  values={lists.allowed_domains}
                  label={t("settings.allowed_domains")}
                  onChange={(list) => setList("allowed_domains", list)}
                />
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            ONGLET 4 : EMAILS & NOTIFICATIONS (DASHBOARD COMPLET)
            =================================================================== */}
        {activeTab === "notifications" && (
          <div className="stack stack--lg">
            {/* Statut du Serveur SMTP */}
            <section className="card card--pad stack">
              <div className="inline" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="inline" style={{ gap: 10 }}>
                  <Mail size={20} className="text-accent" />
                  <h2 style={{ margin: 0 }}>{t("settings.group_email_server")}</h2>
                </div>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  disabled={testEmailLoading || !smtpStatus?.configured}
                  onClick={handleSendTestEmail}
                >
                  <Send size={15} className={testEmailLoading ? "spin" : ""} />
                  <span>{testEmailLoading ? t("settings.smtp_testing") : t("settings.smtp_test_btn")}</span>
                </button>
              </div>

              {testEmailFeedback && (
                <p className={`alert alert--${testEmailFeedback.type}`}>
                  {testEmailFeedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testEmailFeedback.message}</span>
                </p>
              )}

              <div
                style={{
                  background: smtpStatus?.configured ? "rgba(13, 148, 136, 0.08)" : "rgba(239, 68, 68, 0.08)",
                  border: `1px solid ${smtpStatus?.configured ? "rgba(13, 148, 136, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                }}
              >
                <div className="inline" style={{ gap: 8, marginBottom: 6 }}>
                  {smtpStatus?.configured ? (
                    <CheckCircle2 size={18} style={{ color: "#0d9488" }} />
                  ) : (
                    <AlertCircle size={18} style={{ color: "#ef4444" }} />
                  )}
                  <strong style={{ color: smtpStatus?.configured ? "#0f766e" : "#b91c1c" }}>
                    {smtpStatus?.configured
                      ? t("settings.smtp_status_connected")
                      : t("settings.smtp_status_unconfigured")}
                  </strong>
                </div>
                <div className="grid grid--2" style={{ gap: 8, fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                  <div>
                    <span>{t("settings.smtp_host_label")} : </span>
                    <strong style={{ color: "var(--text-strong)" }}>{smtpStatus?.smtp_host || "—"}</strong>
                    {smtpStatus?.smtp_port && ` (port ${smtpStatus.smtp_port})`}
                  </div>
                  <div>
                    <span>{t("settings.smtp_sender_label")} : </span>
                    <strong style={{ color: "var(--text-strong)" }}>{smtpStatus?.smtp_from || "—"}</strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={values.email_notifications_enabled === "true"}
                    onChange={(event) => setBool("email_notifications_enabled", event.target.checked)}
                  />
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="strong">{t("settings.email_notifications_enabled")}</span>
                    <span className="field__hint">{t("settings.email_notifications_enabled_hint")}</span>
                  </div>
                </label>
              </div>
            </section>

            {/* Déclencheurs et Règles d'Envoi (Quand, Pourquoi, Comment) */}
            <section className="card card--pad stack">
              <div>
                <h2>{t("settings.group_email_triggers")}</h2>
                <p className="field__hint">{t("settings.group_email_triggers_hint")}</p>
              </div>

              <div className="stack" style={{ gap: 14 }}>
                {/* 1. Code OTP */}
                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <KeyRound size={17} style={{ color: "var(--accent)" }} />
                      <strong style={{ fontSize: 15 }}>{t("settings.email_otp_title")}</strong>
                    </div>
                    <span className="chip chip--neutral" style={{ fontSize: 12 }}>
                      Système (Toujours actif)
                    </span>
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
                    <div>{t("settings.email_otp_when")}</div>
                    <div>{t("settings.email_otp_why")}</div>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t("settings.email_otp_to")}</div>
                  </div>
                </div>

                {/* 2. Nouvelle Réservation */}
                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <MailCheck size={17} className="text-accent" />
                      <strong style={{ fontSize: 15 }}>{t("settings.email_new_res_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      checked={values.email_notify_new_reservation === "true"}
                      onChange={(event) => setBool("email_notify_new_reservation", event.target.checked)}
                    />
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
                    <div>{t("settings.email_new_res_when")}</div>
                    <div>{t("settings.email_new_res_why")}</div>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t("settings.email_new_res_to")}</div>
                  </div>
                </div>

                {/* 3. Validation / Refus */}
                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <CheckCircle2 size={17} style={{ color: "#10b981" }} />
                      <strong style={{ fontSize: 15 }}>{t("settings.email_approval_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      checked={values.email_notify_approval === "true"}
                      onChange={(event) => setBool("email_notify_approval", event.target.checked)}
                    />
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
                    <div>{t("settings.email_approval_when")}</div>
                    <div>{t("settings.email_approval_why")}</div>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t("settings.email_approval_to")}</div>
                  </div>
                </div>

                {/* 4. Rappel avant restitution */}
                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <Clock size={17} style={{ color: "#f59e0b" }} />
                      <strong style={{ fontSize: 15 }}>{t("settings.email_reminder_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      checked={values.email_notify_reminder === "true"}
                      onChange={(event) => setBool("email_notify_reminder", event.target.checked)}
                    />
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
                    <div>{t("settings.email_reminder_when")}</div>
                    <div>{t("settings.email_reminder_why")}</div>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t("settings.email_reminder_to")}</div>
                  </div>
                  {values.email_notify_reminder === "true" && (
                    <div style={{ marginTop: 12, maxWidth: 300 }}>
                      <label className="field">
                        <span className="field__label" style={{ fontSize: 12.5 }}>
                          {t("settings.email_reminder_hours_before")}
                        </span>
                        <input
                          type="number"
                          className="input"
                          min={1}
                          max={168}
                          value={values.email_reminder_hours_before ?? "24"}
                          onChange={(e) => set("email_reminder_hours_before", e.target.value)}
                        />
                        <span className="field__hint">{t("settings.email_reminder_hours_before_hint")}</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 5. Alerte Retard */}
                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <AlertCircle size={17} style={{ color: "#ef4444" }} />
                      <strong style={{ fontSize: 15 }}>{t("settings.email_overdue_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      checked={values.email_notify_overdue === "true"}
                      onChange={(event) => setBool("email_notify_overdue", event.target.checked)}
                    />
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
                    <div>{t("settings.email_overdue_when")}</div>
                    <div>{t("settings.email_overdue_why")}</div>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t("settings.email_overdue_to")}</div>
                  </div>
                </div>

                {/* 6. Alerte Stock Critique */}
                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 10,
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="inline" style={{ gap: 8 }}>
                      <PackageAlert size={17} style={{ color: "#8b5cf6" }} />
                      <strong style={{ fontSize: 15 }}>{t("settings.email_stock_alert_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      checked={values.email_notify_stock_alert === "true"}
                      onChange={(event) => setBool("email_notify_stock_alert", event.target.checked)}
                    />
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
                    <div>{t("settings.email_stock_alert_when")}</div>
                    <div>{t("settings.email_stock_alert_why")}</div>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t("settings.email_stock_alert_to")}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="field">
                  <span className="field__label">{t("settings.email_staff_notification_address")}</span>
                  <input
                    type="email"
                    className="input"
                    value={values.email_staff_notification_address ?? ""}
                    placeholder="contact@florianriviere.com"
                    onChange={(event) => set("email_staff_notification_address", event.target.value)}
                  />
                  <span className="field__hint">{t("settings.email_staff_notification_address_hint")}</span>
                </label>
              </div>
            </section>

            {/* Webhook Discord */}
            <section className="card card--pad stack">
              <h2>{t("settings.discord_webhook_url")}</h2>
              <label className="field">
                <span className="field__hint">{t("settings.discord_webhook_url_hint")}</span>
                <input
                  type="url"
                  className="input"
                  value={values.discord_webhook_url ?? ""}
                  placeholder="https://discord.com/api/webhooks/…"
                  onChange={(event) => set("discord_webhook_url", event.target.value)}
                />
              </label>
            </section>
          </div>
        )}

        {error && (
          <p className="alert alert--error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </p>
        )}
      </form>

      {/* Barre d'enregistrement collante / flottante */}
      {dirty.length > 0 && (
        <div className="save-bar">
          <div className="save-bar__text">
            <strong>{t("settings.unsaved_changes")}</strong>
            <span className="muted" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
              {dirty.length} paramètre(s) modifié(s)
            </span>
          </div>
          <div className="inline" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={saving}
              onClick={resetChanges}
            >
              <RotateCcw size={16} />
              {t("app.cancel")}
            </button>
            <button
              type="button"
              className="btn btn--accent btn--sm"
              disabled={saving}
              onClick={() => save()}
            >
              <Save size={16} />
              {saving ? t("app.saving") : t("app.save")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
