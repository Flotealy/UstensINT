"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  History,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import { useTranslation } from "../../../components/I18nProvider";
import { ApiError, api } from "../../../lib/api";
import { formatDateTime, initials } from "../../../lib/format";
import { AuditLog } from "../../../lib/types";

const ACTION_FILTERS = [
  { key: "AUTH", label: "Connexions / Inscriptions" },
  { key: "RESERVATION", label: "Réservations & Prêts" },
  { key: "EQUIPMENT", label: "Matériel" },
  { key: "CATEGORY", label: "Catégories" },
  { key: "STOCK", label: "Stock & Nourriture" },
  { key: "USER", label: "Utilisateurs & Rôles" },
  { key: "SETTING", label: "Paramètres" },
];

export default function AuditLogsPage() {
  const { t, locale } = useTranslation();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLogs(await api<AuditLog[]>("/audit-logs?limit=250"));
      setError("");
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 0
          ? t("app.error_network")
          : t("app.error_generic"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (activeGroup && !log.action.startsWith(activeGroup)) return false;
      if (!needle) return true;
      return (
        (log.user_email ?? "").toLowerCase().includes(needle) ||
        (log.user_name ?? "").toLowerCase().includes(needle) ||
        log.action.toLowerCase().includes(needle) ||
        (log.details ?? "").toLowerCase().includes(needle) ||
        (log.target_type ?? "").toLowerCase().includes(needle) ||
        (log.target_id ?? "").toLowerCase().includes(needle)
      );
    });
  }, [logs, search, activeGroup]);

  const actionBadge = (action: string) => {
    if (action.includes("CREATE") || action.includes("REGISTER") || action.includes("APPROVED")) {
      return "badge badge--approved";
    }
    if (action.includes("UPDATE") || action.includes("LOGIN")) {
      return "badge badge--pending";
    }
    if (action.includes("DELETE") || action.includes("CANCEL") || action.includes("BLOCK") || action.includes("ARCHIVE")) {
      return "badge badge--danger";
    }
    return "badge badge--muted";
  };

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("audit.title")}</h1>
          <p className="page-head__sub">{t("audit.subtitle")}</p>
        </div>
      </div>

      <div className="filters">
        <div className="filters__row">
          <div className="input-icon">
            <Search size={18} />
            <input
              type="search"
              className="input"
              placeholder={t("audit.search_placeholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("app.search")}
            />
          </div>
        </div>

        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={activeGroup === null}
            onClick={() => setActiveGroup(null)}
          >
            {t("audit.filter_all")}
            <span className="chip__count">{logs.length}</span>
          </button>
          {ACTION_FILTERS.map((filter) => {
            const count = logs.filter((l) => l.action.startsWith(filter.key)).length;
            if (count === 0) return null;
            return (
              <button
                key={filter.key}
                type="button"
                className="chip"
                aria-pressed={activeGroup === filter.key}
                onClick={() => setActiveGroup(activeGroup === filter.key ? null : filter.key)}
              >
                {filter.label}
                <span className="chip__count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="alert alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </p>
      ) : loading ? (
        <div className="loading-block">
          <span className="spinner" aria-hidden />
          {t("app.loading")}
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <History size={44} />
          <h2>{t("audit.empty_title")}</h2>
          <p>{t("audit.empty_text")}</p>
        </div>
      ) : (
        <div className="list">
          {visible.map((log) => (
            <div key={log.id} className="row">
              <span className="row__main">
                <span
                  className="nav__avatar"
                  style={{
                    background: "var(--surface-tint)",
                    color: "var(--primary-deep)",
                    width: 40,
                    height: 40,
                  }}
                >
                  {log.user_name ? initials(log.user_name) : <User size={18} />}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="row__title">
                    <span className={actionBadge(log.action)}>{log.action}</span>
                    <span>{log.user_name || log.user_email || "Système / Anonyme"}</span>
                    <span className="tag">
                      {log.target_type}
                      {log.target_id ? ` #${log.target_id.slice(0, 8)}` : ""}
                    </span>
                  </span>
                  <span className="row__sub" style={{ marginTop: 4 }}>
                    {log.user_email && <span className="muted">{log.user_email} · </span>}
                    {log.details && (
                      <code
                        style={{
                          background: "var(--bg)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 12.5,
                          fontFamily: "monospace",
                        }}
                      >
                        {log.details}
                      </code>
                    )}
                  </span>
                </span>
              </span>

              <span className="row__aside">
                <span className="muted inline" style={{ gap: 5, fontSize: 13 }}>
                  <Clock size={14} />
                  {formatDateTime(log.created_at, locale)}
                </span>
                {log.ip_address && (
                  <span className="tag" title="IP anonymisée (RGPD)">
                    {log.ip_address}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
