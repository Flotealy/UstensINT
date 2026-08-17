"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Ban, CheckCircle2, Search, Users } from "lucide-react";
import { useTranslation } from "../../../components/I18nProvider";
import { useSession } from "../../../components/SessionProvider";
import { ApiError, api } from "../../../lib/api";
import { fold, formatDate, initials } from "../../../lib/format";
import { Role, UserProfile } from "../../../lib/types";

const ROLES: Role[] = ["user", "moderator", "admin"];

export default function UsersPage() {
  const { t, locale } = useTranslation();
  const { user: currentUser } = useSession();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await api<UserProfile[]>("/users"));
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

  const update = async (id: string, patch: Partial<Pick<UserProfile, "role" | "is_blocked">>) => {
    setBusyId(id);
    setError("");
    try {
      const updated = await api<UserProfile>(`/users/${id}`, { method: "PATCH", json: patch });
      setUsers((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    const needle = fold(search);
    if (!needle) return users;
    return users.filter(
      (item) => fold(item.display_name).includes(needle) || fold(item.email).includes(needle),
    );
  }, [users, search]);

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("users.title")}</h1>
          <p className="page-head__sub">{t("users.subtitle")}</p>
        </div>
      </div>

      <div className="filters">
        <div className="filters__row">
          <div className="input-icon">
            <Search size={18} />
            <input
              type="search"
              className="input"
              placeholder={t("users.search_placeholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("app.search")}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="alert alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </p>
      )}

      {loading ? (
        <div className="loading-block">
          <span className="spinner" aria-hidden />
          {t("app.loading")}
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <Users size={40} />
          <h2>{t("users.empty_title")}</h2>
          <p>{t("users.empty_text")}</p>
        </div>
      ) : (
        <div className="list">
          {visible.map((item) => {
            const isSelf = item.id === currentUser?.id;
            const protectedAccount = item.role === "admin";
            return (
              <div key={item.id} className="row">
                <span className="row__main">
                  <span className="nav__avatar" style={{ background: "var(--surface-tint)" }}>
                    {initials(item.display_name)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="row__title">
                      {item.display_name}
                      {item.is_blocked ? (
                        <span className="badge badge--danger">
                          <Ban size={13} />
                          {t("users.state_blocked")}
                        </span>
                      ) : (
                        <span className="badge badge--muted">
                          <CheckCircle2 size={13} />
                          {t("users.state_active")}
                        </span>
                      )}
                    </span>
                    <span className="row__sub truncate">
                      {item.email} · {t("users.joined", { date: formatDate(item.created_at, locale) })}
                    </span>
                  </span>
                </span>

                <span className="row__actions">
                  <select
                    className="select"
                    style={{ minHeight: 38, width: 160 }}
                    value={item.role}
                    disabled={busyId === item.id || isSelf}
                    aria-label={`${t("users.role")} — ${item.display_name}`}
                    onChange={(event) => update(item.id, { role: event.target.value as Role })}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t(`roles.${role}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={item.is_blocked ? "btn btn--ghost btn--sm" : "btn btn--danger-soft btn--sm"}
                    disabled={busyId === item.id || protectedAccount}
                    title={protectedAccount ? t("users.admin_protected") : undefined}
                    onClick={() => update(item.id, { is_blocked: !item.is_blocked })}
                  >
                    {item.is_blocked ? t("users.unblock") : t("users.block")}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
