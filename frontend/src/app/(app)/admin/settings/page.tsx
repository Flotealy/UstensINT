"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Hash,
  Mail,
  MailCheck,
  MessageSquare,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Sliders,
  Trash2,
  Users,
  Utensils,
  X,
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

const MAX_KEYS = ["max_reservation_days", "max_advance_days"] as const;

/** Événements notifiables : chacun est diffusable par email et/ou Discord. */
const NOTIFICATION_EVENTS = [
  { key: "new_reservation", icon: MailCheck, color: "var(--primary)" },
  { key: "approval", icon: CheckCircle2, color: "var(--accent-deep)" },
  { key: "reminder", icon: Clock, color: "#d97706" },
  { key: "overdue", icon: AlertCircle, color: "var(--danger)" },
  { key: "stock_alert", icon: Package, color: "#7c3aed" },
] as const;

type NotificationChannel = "email" | "discord";

const channelKey = (event: string, channel: NotificationChannel) =>
  `notify_${event}_${channel}`;

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
  notifications_enabled: "true",
  email_reminder_hours_before: "24",
  discord_webhooks: "[]",
  ...Object.fromEntries(
    NOTIFICATION_EVENTS.flatMap((event) => [
      [channelKey(event.key, "email"), "true"],
      [channelKey(event.key, "discord"), "false"],
    ]),
  ),
};

type SettingsTab = "rules" | "equipment" | "access" | "notifications";

interface DiscordWebhook {
  name: string;
  url: string;
}

function parseWebhooks(raw: string | undefined): DiscordWebhook[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) =>
      typeof entry === "string"
        ? { name: "Discord", url: entry }
        : {
            name: String((entry as DiscordWebhook)?.name ?? ""),
            url: String((entry as DiscordWebhook)?.url ?? ""),
          },
    );
  } catch {
    return [];
  }
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

  const [testingWebhook, setTestingWebhook] = useState<number | null>(null);
  const [webhookFeedback, setWebhookFeedback] = useState<{
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

        // Reprise des anciens paramètres : interrupteur global, bascules email
        // par événement et webhook unique historique.
        const legacyMaster = mapped.email_notifications_enabled;
        if (legacyMaster && !items.some((item) => item.key === "notifications_enabled")) {
          mapped.notifications_enabled = legacyMaster;
        }
        for (const event of NOTIFICATION_EVENTS) {
          const key = channelKey(event.key, "email");
          const legacy = mapped[`email_notify_${event.key}`];
          if (legacy && !items.some((item) => item.key === key)) {
            mapped[key] = legacy;
          }
        }
        if (parseWebhooks(mapped.discord_webhooks).length === 0 && mapped.discord_webhook_url) {
          mapped.discord_webhooks = JSON.stringify([
            { name: "Discord", url: mapped.discord_webhook_url },
          ]);
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
  }, [t]);

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

  const setBool = (key: string, next: boolean) => {
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

  // --- Webhooks Discord ---
  const webhooks = useMemo(() => parseWebhooks(values.discord_webhooks), [values]);
  const usableWebhooks = webhooks.filter((hook) => hook.url.trim().length > 0);

  const setWebhooks = (next: DiscordWebhook[]) => {
    set("discord_webhooks", JSON.stringify(next));
  };

  const updateWebhook = (index: number, patch: Partial<DiscordWebhook>) => {
    setWebhooks(webhooks.map((hook, idx) => (idx === index ? { ...hook, ...patch } : hook)));
  };

  const testWebhook = async (index: number) => {
    const hook = webhooks[index];
    if (!hook?.url.trim()) return;

    setTestingWebhook(index);
    setWebhookFeedback(null);
    try {
      const res = await api<{ message: string }>("/settings/test-webhook", {
        method: "POST",
        json: { url: hook.url.trim() },
      });
      setWebhookFeedback({ type: "success", message: res.message });
    } catch (caught) {
      setWebhookFeedback({
        type: "error",
        message: caught instanceof Error ? caught.message : t("app.error_generic"),
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const resetChanges = () => {
    setValues(initial);
    setError("");
    setWebhookFeedback(null);
  };

  const save = async () => {
    if (dirty.length === 0) return;
    setSaving(true);
    setError("");
    setSavedSuccess(false);

    const payload = { ...values };
    if (dirty.includes("discord_webhooks")) {
      // On ne persiste que les webhooks réellement renseignés, et on solde
      // l'ancien paramètre mono-webhook pour éviter un doublon fantôme.
      payload.discord_webhooks = JSON.stringify(
        usableWebhooks.map((hook) => ({
          name: hook.name.trim() || "Discord",
          url: hook.url.trim(),
        })),
      );
      payload.discord_webhook_url = "";
    }

    const keys = Object.keys(payload).filter((key) => payload[key] !== initial[key]);

    try {
      for (const key of keys) {
        await api(`/settings/${key}`, { method: "PATCH", json: { value: payload[key] } });
      }
      setValues(payload);
      setInitial({ ...payload });
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
                {MAX_KEYS.map((key) => (
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
            ONGLET 4 : NOTIFICATIONS (canaux email & Discord)
            =================================================================== */}
        {activeTab === "notifications" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Interrupteur général */}
            <section className="card card--pad">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <BellRing size={20} color="var(--primary)" />
                <h2 style={{ margin: 0 }}>{t("settings.group_notifications")}</h2>
              </div>
              <label className="switch" style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={values.notifications_enabled === "true"}
                  onChange={(event) => setBool("notifications_enabled", event.target.checked)}
                />
                <span className="switch__track">
                  <span className="switch__thumb" />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", color: "var(--ink-strong)", fontSize: 14.5 }}>
                    {t("settings.notifications_enabled")}
                  </strong>
                  <span className="field__hint">{t("settings.notifications_enabled_hint")}</span>
                </span>
              </label>
            </section>

            {/* Salons Discord */}
            <section className="card card--pad">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Hash size={20} color="#5865F2" />
                <h2 style={{ margin: 0 }}>{t("settings.group_webhooks")}</h2>
              </div>
              <p className="field__hint" style={{ marginBottom: 16 }}>
                {t("settings.group_webhooks_hint")}
              </p>

              {webhookFeedback && (
                <p
                  className={`alert ${webhookFeedback.type === "success" ? "alert--ok" : "alert--error"}`}
                  style={{ marginBottom: 14 }}
                >
                  {webhookFeedback.type === "success" ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertCircle size={18} />
                  )}
                  <span>{webhookFeedback.message}</span>
                </p>
              )}

              <div className="notif-list">
                {webhooks.length === 0 && (
                  <p className="field__hint">{t("settings.webhook_empty")}</p>
                )}

                {webhooks.map((hook, index) => (
                  <div key={index} className="webhook-row">
                    <input
                      type="text"
                      className="input webhook-row__name"
                      value={hook.name}
                      placeholder={t("settings.webhook_name")}
                      onChange={(event) => updateWebhook(index, { name: event.target.value })}
                    />
                    <input
                      type="url"
                      className="input webhook-row__url"
                      value={hook.url}
                      placeholder="https://discord.com/api/webhooks/…"
                      onChange={(event) => updateWebhook(index, { url: event.target.value })}
                    />
                    <div className="webhook-row__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={testingWebhook !== null || !hook.url.trim()}
                        onClick={() => testWebhook(index)}
                      >
                        <Send size={15} />
                        <span>
                          {testingWebhook === index
                            ? t("settings.webhook_testing")
                            : t("settings.webhook_test")}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--icon is-danger"
                        aria-label={t("settings.webhook_remove")}
                        onClick={() => setWebhooks(webhooks.filter((_, idx) => idx !== index))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                <div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setWebhooks([...webhooks, { name: "", url: "" }])}
                  >
                    <Plus size={16} />
                    <span>{t("settings.webhook_add")}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Événements : email et/ou Discord */}
            <section className="card card--pad">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                <h2 style={{ margin: 0 }}>{t("settings.group_events")}</h2>
                {values.notifications_enabled !== "true" && (
                  <span className="badge badge--danger">{t("settings.notifications_paused")}</span>
                )}
              </div>
              <p className="field__hint" style={{ marginBottom: 16 }}>
                {t("settings.group_events_hint")}
              </p>

              <div
                className="notif-list"
                style={{ opacity: values.notifications_enabled === "true" ? 1 : 0.55 }}
              >
                {NOTIFICATION_EVENTS.map((event) => {
                  const Icon = event.icon;
                  const emailKey = channelKey(event.key, "email");
                  const discordKey = channelKey(event.key, "discord");
                  const discordOn = values[discordKey] === "true";

                  return (
                    <div key={event.key} className="notif-row">
                      <div className="notif-row__text">
                        <div className="notif-row__title">
                          <Icon size={17} color={event.color} />
                          <span>{t(`settings.event_${event.key}`)}</span>
                        </div>
                        <p className="notif-row__when">{t(`settings.event_${event.key}_when`)}</p>

                        {event.key === "reminder" && (
                          <label
                            className="field"
                            style={{ marginTop: 10, maxWidth: 220 }}
                          >
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
                          </label>
                        )}
                      </div>

                      <div className="notif-row__channels">
                        <button
                          type="button"
                          className="toggle-pill"
                          aria-pressed={values[emailKey] === "true"}
                          onClick={() => setBool(emailKey, values[emailKey] !== "true")}
                        >
                          <Mail size={15} />
                          <span>{t("settings.channel_email")}</span>
                        </button>
                        <button
                          type="button"
                          className="toggle-pill"
                          aria-pressed={discordOn}
                          disabled={usableWebhooks.length === 0 && !discordOn}
                          title={
                            usableWebhooks.length === 0 ? t("settings.webhook_needed") : undefined
                          }
                          onClick={() => setBool(discordKey, !discordOn)}
                        >
                          <Hash size={15} />
                          <span>{t("settings.channel_discord")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
