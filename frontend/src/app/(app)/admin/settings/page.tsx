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
  Package,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {values.length === 0 ? (
        <p className="field__hint">{t("settings.list_empty")}</p>
      ) : (
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {values.map((value, idx) => (
            <span key={value} className="chip">
              <span>{value}</span>
              <button
                type="button"
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", marginLeft: 4 }}
                onClick={() => remove(idx)}
                aria-label={t("settings.list_remove", { value })}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          className="input"
          style={{ flex: "1 1 180px", minWidth: 0 }}
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
          className="btn btn--ghost btn--sm"
          style={{ flexShrink: 0 }}
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
      <main className="content">
        <div className="card card--pad">
          <p className="field__hint">{t("app.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="content" style={{ paddingBottom: dirty.length > 0 ? "110px" : undefined }}>
      {/* En-tête de page */}
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("settings.title")}</h1>
          <p className="page-head__sub">{t("settings.subtitle")}</p>
        </div>
        {savedSuccess && (
          <span className="badge badge--approved">
            <CheckCircle2 size={14} />
            <span>{t("settings.saved")}</span>
          </span>
        )}
      </div>

      {/* Barre d'onglets au design Cook'It avec défilement fluide sur mobile */}
      <div className="filters">
        <div className="chips">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className="chip"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card card--pad">
              <h2 style={{ marginBottom: 16 }}>{t("settings.group_rules")}</h2>
              <div className="form-grid form-grid--2">
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

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }}
                    checked={values.auto_approve_reservations === "true"}
                    onChange={(event) => setBool("auto_approve_reservations", event.target.checked)}
                  />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", color: "var(--ink-strong)", fontSize: 14.5 }}>
                      {t("settings.auto_approve_reservations")}
                    </strong>
                    <p className="field__hint" style={{ margin: "3px 0 0 0" }}>
                      {t("settings.auto_approve_reservations_hint")}
                    </p>
                  </div>
                </label>
              </div>
            </section>

            <section className="card card--pad">
              <h2>{t("settings.group_form")}</h2>
              <p className="field__hint" style={{ marginBottom: 16 }}>{t("settings.group_form_hint")}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }}
                    checked={values.require_phone === "true"}
                    onChange={(event) => setBool("require_phone", event.target.checked)}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={15} color="var(--primary)" />
                      <strong style={{ color: "var(--ink-strong)", fontSize: 14.5 }}>{t("settings.require_phone")}</strong>
                    </div>
                    <span className="field__hint">{t("settings.require_phone_hint")}</span>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }}
                    checked={values.require_comments === "true"}
                    onChange={(event) => setBool("require_comments", event.target.checked)}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MessageSquare size={15} color="var(--primary)" />
                      <strong style={{ color: "var(--ink-strong)", fontSize: 14.5 }}>{t("settings.require_comments")}</strong>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card card--pad">
              <h2 style={{ marginBottom: 12 }}>{t("settings.deposit_types")}</h2>
              <div className="field">
                <span className="field__hint" style={{ marginBottom: 8 }}>{t("settings.deposit_types_hint")}</span>
                <ListEditor
                  values={lists.deposit_types}
                  label={t("settings.deposit_types")}
                  onChange={(list) => setList("deposit_types", list)}
                />
              </div>
            </section>

            <section className="card card--pad">
              <h2 style={{ marginBottom: 12 }}>{t("settings.equipment_statuses")}</h2>
              <div className="field">
                <span className="field__hint" style={{ marginBottom: 8 }}>{t("settings.equipment_statuses_hint")}</span>
                <ListEditor
                  values={lists.equipment_statuses}
                  label={t("settings.equipment_statuses")}
                  onChange={(list) => setList("equipment_statuses", list)}
                />
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <ShieldAlert size={16} color="var(--accent-deep)" />
                  <strong style={{ color: "var(--ink-strong)" }}>{t("settings.group_blocking")}</strong>
                </div>
                <p className="field__hint" style={{ marginBottom: 12 }}>{t("settings.group_blocking_hint")}</p>
                <div className="chips" style={{ flexWrap: "wrap" }}>
                  {lists.equipment_statuses.map((status) => {
                    const isBlocking = lists.blocking_equipment_statuses.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        className={`chip ${isBlocking ? "is-active" : ""}`}
                        style={isBlocking ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" } : {}}
                        onClick={() => {
                          const next = isBlocking
                            ? lists.blocking_equipment_statuses.filter((s) => s !== status)
                            : [...lists.blocking_equipment_statuses, status];
                          setList("blocking_equipment_statuses", next);
                        }}
                      >
                        {isBlocking && <Ban size={13} />}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card card--pad">
              <h2 style={{ marginBottom: 12 }}>{t("settings.allowed_domains")}</h2>
              <div className="field">
                <span className="field__hint" style={{ marginBottom: 8 }}>{t("settings.allowed_domains_hint")}</span>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Statut du Serveur SMTP */}
            <section className="card card--pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Mail size={22} color="var(--primary)" />
                  <h2 style={{ margin: 0 }}>{t("settings.group_email_server")}</h2>
                </div>
                <button
                  type="button"
                  className="btn btn--accent btn--sm"
                  disabled={testEmailLoading || !smtpStatus?.configured}
                  onClick={handleSendTestEmail}
                >
                  <Send size={15} />
                  <span>{testEmailLoading ? t("settings.smtp_testing") : t("settings.smtp_test_btn")}</span>
                </button>
              </div>

              {testEmailFeedback && (
                <p className={`alert ${testEmailFeedback.type === "success" ? "alert--ok" : "alert--error"}`} style={{ marginBottom: 14 }}>
                  {testEmailFeedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testEmailFeedback.message}</span>
                </p>
              )}

              <div
                style={{
                  background: smtpStatus?.configured ? "rgba(72, 188, 188, 0.12)" : "rgba(210, 60, 60, 0.12)",
                  border: `1px solid ${smtpStatus?.configured ? "rgba(72, 188, 188, 0.35)" : "rgba(210, 60, 60, 0.3)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  {smtpStatus?.configured ? (
                    <CheckCircle2 size={18} color="var(--accent-deep)" />
                  ) : (
                    <AlertCircle size={18} color="var(--danger)" />
                  )}
                  <strong style={{ color: smtpStatus?.configured ? "var(--primary-deep)" : "var(--danger)", fontSize: 14.5 }}>
                    {smtpStatus?.configured
                      ? t("settings.smtp_status_connected")
                      : t("settings.smtp_status_unconfigured")}
                  </strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}>
                  <div>
                    <span>{t("settings.smtp_host_label")} : </span>
                    <strong style={{ color: "var(--ink-strong)" }}>{smtpStatus?.smtp_host || "—"}</strong>
                    {smtpStatus?.smtp_port && ` (port ${smtpStatus.smtp_port})`}
                  </div>
                  <div>
                    <span>{t("settings.smtp_sender_label")} : </span>
                    <strong style={{ color: "var(--ink-strong)" }}>{smtpStatus?.smtp_from || "—"}</strong>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 8 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }}
                    checked={values.email_notifications_enabled === "true"}
                    onChange={(event) => setBool("email_notifications_enabled", event.target.checked)}
                  />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", color: "var(--ink-strong)", fontSize: 14.5 }}>
                      {t("settings.email_notifications_enabled")}
                    </strong>
                    <span className="field__hint">{t("settings.email_notifications_enabled_hint")}</span>
                  </div>
                </label>
              </div>
            </section>

            {/* Déclencheurs et Règles d'Envoi (Quand, Pourquoi, Comment) */}
            <section className="card card--pad">
              <h2 style={{ marginBottom: 4 }}>{t("settings.group_email_triggers")}</h2>
              <p className="field__hint" style={{ marginBottom: 18 }}>{t("settings.group_email_triggers_hint")}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* 1. Code OTP */}
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <KeyRound size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: 15, color: "var(--ink-strong)" }}>{t("settings.email_otp_title")}</strong>
                    </div>
                    <span className="badge badge--muted" style={{ flexShrink: 0 }}>Système (Toujours actif)</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--ink-soft)" }}>
                    <div>{t("settings.email_otp_when")}</div>
                    <div>{t("settings.email_otp_why")}</div>
                    <div style={{ color: "var(--ink-strong)", fontWeight: 500 }}>{t("settings.email_otp_to")}</div>
                  </div>
                </div>

                {/* 2. Nouvelle Réservation */}
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <MailCheck size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: 15, color: "var(--ink-strong)" }}>{t("settings.email_new_res_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: "var(--accent)", flexShrink: 0 }}
                      checked={values.email_notify_new_reservation === "true"}
                      onChange={(event) => setBool("email_notify_new_reservation", event.target.checked)}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--ink-soft)" }}>
                    <div>{t("settings.email_new_res_when")}</div>
                    <div>{t("settings.email_new_res_why")}</div>
                    <div style={{ color: "var(--ink-strong)", fontWeight: 500 }}>{t("settings.email_new_res_to")}</div>
                  </div>
                </div>

                {/* 3. Validation / Refus */}
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <CheckCircle2 size={17} color="var(--accent-deep)" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: 15, color: "var(--ink-strong)" }}>{t("settings.email_approval_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: "var(--accent)", flexShrink: 0 }}
                      checked={values.email_notify_approval === "true"}
                      onChange={(event) => setBool("email_notify_approval", event.target.checked)}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--ink-soft)" }}>
                    <div>{t("settings.email_approval_when")}</div>
                    <div>{t("settings.email_approval_why")}</div>
                    <div style={{ color: "var(--ink-strong)", fontWeight: 500 }}>{t("settings.email_approval_to")}</div>
                  </div>
                </div>

                {/* 4. Rappel avant restitution */}
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <Clock size={17} color="#d97706" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: 15, color: "var(--ink-strong)" }}>{t("settings.email_reminder_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: "var(--accent)", flexShrink: 0 }}
                      checked={values.email_notify_reminder === "true"}
                      onChange={(event) => setBool("email_notify_reminder", event.target.checked)}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--ink-soft)" }}>
                    <div>{t("settings.email_reminder_when")}</div>
                    <div>{t("settings.email_reminder_why")}</div>
                    <div style={{ color: "var(--ink-strong)", fontWeight: 500 }}>{t("settings.email_reminder_to")}</div>
                  </div>
                  {values.email_notify_reminder === "true" && (
                    <div style={{ marginTop: 12 }}>
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
                  style={{
                    padding: "16px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <AlertCircle size={17} color="var(--danger)" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: 15, color: "var(--ink-strong)" }}>{t("settings.email_overdue_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: "var(--accent)", flexShrink: 0 }}
                      checked={values.email_notify_overdue === "true"}
                      onChange={(event) => setBool("email_notify_overdue", event.target.checked)}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--ink-soft)" }}>
                    <div>{t("settings.email_overdue_when")}</div>
                    <div>{t("settings.email_overdue_why")}</div>
                    <div style={{ color: "var(--ink-strong)", fontWeight: 500 }}>{t("settings.email_overdue_to")}</div>
                  </div>
                </div>

                {/* 6. Alerte Stock Critique */}
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <Package size={17} color="#7c3aed" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: 15, color: "var(--ink-strong)" }}>{t("settings.email_stock_alert_title")}</strong>
                    </div>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, accentColor: "var(--accent)", flexShrink: 0 }}
                      checked={values.email_notify_stock_alert === "true"}
                      onChange={(event) => setBool("email_notify_stock_alert", event.target.checked)}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "var(--ink-soft)" }}>
                    <div>{t("settings.email_stock_alert_when")}</div>
                    <div>{t("settings.email_stock_alert_why")}</div>
                    <div style={{ color: "var(--ink-strong)", fontWeight: 500 }}>{t("settings.email_stock_alert_to")}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
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
            <section className="card card--pad">
              <h2 style={{ marginBottom: 8 }}>{t("settings.discord_webhook_url")}</h2>
              <label className="field">
                <span className="field__hint" style={{ marginBottom: 6 }}>{t("settings.discord_webhook_url_hint")}</span>
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

      {/* Barre d'enregistrement flottante 100% responsive */}
      {dirty.length > 0 && (
        <div className="save-bar">
          <div className="save-bar__text">
            <strong className="save-bar__title">{t("settings.unsaved_changes")}</strong>
            <span className="save-bar__sub">
              {dirty.length} paramètre(s) modifié(s)
            </span>
          </div>
          <div className="save-bar__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={saving}
              onClick={resetChanges}
            >
              <RotateCcw size={15} />
              <span>{t("app.cancel")}</span>
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={saving}
              onClick={() => save()}
            >
              <Save size={15} />
              <span>{saving ? t("app.saving") : t("app.save")}</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
