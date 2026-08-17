"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Lock,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  Save,
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

const NUMBER_KEYS = ["max_reservation_days", "max_advance_days"] as const;

const BOOLEAN_KEYS = [
  "auto_approve_reservations",
  "require_phone",
  "require_comments",
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
};

type SettingsTab = "rules" | "equipment" | "access" | "notifications";

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

function ListEditor({
  values,
  onChange,
  label,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value || values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  };

  return (
    <div className="stack stack--sm">
      {values.length === 0 ? (
        <p className="field__hint">{t("settings.list_empty")}</p>
      ) : (
        <div className="inline" style={{ gap: 8 }}>
          {values.map((value) => (
            <span
              key={value}
              className="chip"
              style={{ cursor: "default", paddingRight: 8 }}
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                aria-label={t("settings.list_remove", { value })}
                style={{
                  display: "flex",
                  color: "var(--danger)",
                  padding: 2,
                  marginLeft: 4,
                  borderRadius: "50%",
                }}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="inline" style={{ flexWrap: "nowrap", maxWidth: 440 }}>
        <input
          type="text"
          className="input"
          value={draft}
          placeholder={t("settings.list_placeholder")}
          aria-label={label}
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
          className="btn btn--ghost"
          onClick={add}
          aria-label={t("settings.list_add")}
        >
          <Plus size={18} />
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
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api<Setting[]>("/settings")
      .then((list) => {
        if (cancelled) return;
        const map = { ...DEFAULTS };
        for (const setting of list) map[setting.key] = setting.value;
        setInitial(map);
        setValues(map);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof ApiError && caught.status === 0
            ? t("app.error_network")
            : t("app.error_generic"),
        );
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [t]);

  const lists = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const key of LIST_KEYS) map[key] = parseList(values[key] ?? "");
    return map;
  }, [values]);

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const setBool = (key: string, checked: boolean) => {
    set(key, checked ? "true" : "false");
  };

  const getBool = (key: string): boolean => {
    return values[key] === "true" || values[key] === "1";
  };

  const setList = (key: string, list: string[]) => set(key, JSON.stringify(list));

  const toggleBlockingStatus = (statusName: string) => {
    const currentList = lists.blocking_equipment_statuses ?? [];
    const updated = currentList.includes(statusName)
      ? currentList.filter((s) => s !== statusName)
      : [...currentList, statusName];
    setList("blocking_equipment_statuses", updated);
  };

  const dirty = Object.keys(values).filter((key) => values[key] !== initial[key]);

  const resetChanges = () => {
    setValues(initial);
    setSaved(false);
    setError("");
  };

  const save = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setSaving(true);
    setError("");
    try {
      for (const key of dirty) {
        await api(`/settings/${key}`, { method: "PATCH", json: { value: values[key] } });
      }
      setInitial(values);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
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
        <div className="loading-block">
          <span className="spinner" aria-hidden />
          {t("app.loading")}
        </div>
      </main>
    );
  }

  return (
    <main className="content" style={{ paddingBottom: dirty.length > 0 ? 100 : undefined }}>
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("settings.title")}</h1>
          <p className="page-head__sub">{t("settings.subtitle")}</p>
        </div>
        {saved && dirty.length === 0 && (
          <div className="alert alert--ok" style={{ padding: "8px 14px" }}>
            <CheckCircle2 size={16} />
            <span>{t("settings.saved")}</span>
          </div>
        )}
      </div>

      {/* Onglets thématiques du panneau d'administration */}
      <div className="chips" style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 10 }}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`chip ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <form className="stack stack--lg" onSubmit={save} style={{ marginTop: 16 }}>
        {/* ===================================================================
            ONGLET 1 : RÈGLES & RÉSERVATIONS
            =================================================================== */}
        {activeTab === "rules" && (
          <div className="stack stack--lg">
            {/* Règles temporelles */}
            <section className="card card--pad stack">
              <h2>{t("settings.group_rules")}</h2>
              <div className="form-grid form-grid--2">
                {NUMBER_KEYS.map((key) => (
                  <label key={key} className="field">
                    <span className="field__label">{t(`settings.${key}`)}</span>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      inputMode="numeric"
                      value={values[key] ?? ""}
                      onChange={(event) => set(key, event.target.value)}
                    />
                    <span className="field__hint">{t(`settings.${key}_hint`)}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Auto-approbation des prêts */}
            <section className="card card--pad stack">
              <h2>
                <Zap size={20} color="var(--accent-deep)" />
                {t("settings.auto_approve_reservations")}
              </h2>
              <p className="field__hint">{t("settings.auto_approve_reservations_hint")}</p>
              <label className="switch" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={getBool("auto_approve_reservations")}
                  onChange={(event) => setBool("auto_approve_reservations", event.target.checked)}
                />
                <span className="switch__track">
                  <span className="switch__thumb" />
                </span>
                <span className="strong">
                  {getBool("auto_approve_reservations")
                    ? "Activé (approbation automatique immédiate)"
                    : "Désactivé (validation manuelle par le mandat requise)"}
                </span>
              </label>
            </section>

            {/* Exigences du formulaire de réservation */}
            <section className="card card--pad stack">
              <h2>{t("settings.group_form")}</h2>
              <p className="field__hint">{t("settings.group_form_hint")}</p>

              <div className="stack" style={{ gap: 16, marginTop: 8 }}>
                {/* Téléphone obligatoire */}
                <div
                  className="row"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px 18px",
                  }}
                >
                  <div className="row__main">
                    <Phone size={20} color="var(--primary)" />
                    <div>
                      <span className="row__title">{t("settings.require_phone")}</span>
                      <span className="row__sub">{t("settings.require_phone_hint")}</span>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={getBool("require_phone")}
                      onChange={(event) => setBool("require_phone", event.target.checked)}
                    />
                    <span className="switch__track">
                      <span className="switch__thumb" />
                    </span>
                  </label>
                </div>

                {/* Commentaire obligatoire */}
                <div
                  className="row"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px 18px",
                  }}
                >
                  <div className="row__main">
                    <MessageSquare size={20} color="var(--primary)" />
                    <div>
                      <span className="row__title">{t("settings.require_comments")}</span>
                      <span className="row__sub">{t("settings.require_comments_hint")}</span>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={getBool("require_comments")}
                      onChange={(event) => setBool("require_comments", event.target.checked)}
                    />
                    <span className="switch__track">
                      <span className="switch__thumb" />
                    </span>
                  </label>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            ONGLET 2 : MATÉRIEL & CAUTION
            =================================================================== */}
        {activeTab === "equipment" && (
          <div className="stack stack--lg">
            {/* Types de caution */}
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

            {/* États du matériel & Sélection des bloquants */}
            <section className="card card--pad stack">
              <h2>{t("settings.equipment_statuses")}</h2>
              <div className="field">
                <span className="field__hint">{t("settings.equipment_statuses_hint")}</span>
                <ListEditor
                  values={lists.equipment_statuses}
                  label={t("settings.equipment_statuses")}
                  onChange={(list) => {
                    setList("equipment_statuses", list);
                    const newBlocking = (lists.blocking_equipment_statuses ?? []).filter((s) =>
                      list.includes(s)
                    );
                    setList("blocking_equipment_statuses", newBlocking);
                  }}
                />
              </div>

              <hr className="divider" />

              {/* Choix des états bloquants */}
              <div className="stack stack--sm">
                <div className="inline" style={{ gap: 8 }}>
                  <ShieldAlert size={18} color="var(--danger)" />
                  <span className="strong">{t("settings.group_blocking")}</span>
                </div>
                <p className="field__hint">{t("settings.group_blocking_hint")}</p>

                <div className="inline" style={{ gap: 10, marginTop: 6 }}>
                  {lists.equipment_statuses.map((statusName) => {
                    const isBlocked = (lists.blocking_equipment_statuses ?? []).includes(statusName);
                    return (
                      <button
                        key={statusName}
                        type="button"
                        className={`chip ${isBlocked ? "is-active" : ""}`}
                        style={
                          isBlocked
                            ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }
                            : {}
                        }
                        onClick={() => toggleBlockingStatus(statusName)}
                      >
                        {isBlocked ? <Ban size={14} /> : <Lock size={14} />}
                        {statusName}
                        <span
                          className="chip__count"
                          style={isBlocked ? { background: "rgba(0,0,0,0.25)", color: "#fff" } : {}}
                        >
                          {isBlocked ? "Bloquant" : "Autorisé"}
                        </span>
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
            ONGLET 4 : NOTIFICATIONS & DISCORD
            =================================================================== */}
        {activeTab === "notifications" && (
          <div className="stack stack--lg">
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
