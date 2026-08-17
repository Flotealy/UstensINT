"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Lock,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import Modal from "../../../components/Modal";
import StatusBadge from "../../../components/StatusBadge";
import { useTranslation } from "../../../components/I18nProvider";
import { useSession } from "../../../components/SessionProvider";
import { ApiError, api } from "../../../lib/api";
import { fold, formatDate, formatDateTime, formatMoney } from "../../../lib/format";
import { ReservationDetail, ReservationStatus } from "../../../lib/types";

const TABS: ReservationStatus[] = ["active", "approved", "returned", "cancelled"];

export default function LoansPage() {
  const { t, tn, locale } = useTranslation();
  const { settings } = useSession();

  const [loans, setLoans] = useState<ReservationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ReservationStatus | null>("active");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<ReservationDetail | null>(null);
  const [reasonMode, setReasonMode] = useState(false);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");

  // Edit Mode State
  const [editMode, setEditMode] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDepositType, setEditDepositType] = useState("");
  const [editTotalDeposit, setEditTotalDeposit] = useState<number | string>(0);
  const [editComments, setEditComments] = useState("");
  const [editStaffComment, setEditStaffComment] = useState("");

  const load = useCallback(async () => {
    try {
      setLoans(await api<ReservationDetail[]>("/reservations/admin"));
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

  const counts = useMemo(() => {
    const map = new Map<ReservationStatus, number>();
    for (const loan of loans) map.set(loan.status, (map.get(loan.status) ?? 0) + 1);
    return map;
  }, [loans]);

  const visible = useMemo(() => {
    const needle = fold(search);
    return loans.filter((loan) => {
      if (tab && loan.status !== tab) return false;
      if (!needle) return true;
      return (
        fold(loan.user.display_name).includes(needle) ||
        fold(loan.user.email).includes(needle) ||
        fold(loan.staff_comment ?? "").includes(needle) ||
        fold(loan.comments ?? "").includes(needle) ||
        loan.items.some(
          (item) =>
            fold(item.equipment.name).includes(needle) ||
            fold(item.equipment.label).includes(needle),
        )
      );
    });
  }, [loans, tab, search]);

  const openDetail = (loan: ReservationDetail) => {
    setSelected(loan);
    setReasonMode(false);
    setEditMode(false);
    setReason("");
    setActionError("");
  };

  const openEdit = () => {
    if (!selected) return;
    setEditStartDate(selected.start_date);
    setEditEndDate(selected.end_date);
    setEditPhone(selected.phone ?? "");
    setEditDepositType(selected.deposit_type ?? (settings.deposit_types[0] || "Liquide"));
    setEditTotalDeposit(selected.total_deposit);
    setEditComments(selected.comments ?? "");
    setEditStaffComment(selected.staff_comment ?? "");
    setEditMode(true);
    setReasonMode(false);
    setActionError("");
  };

  const closeDetail = () => {
    setSelected(null);
    setReasonMode(false);
    setEditMode(false);
    setReason("");
    setActionError("");
  };

  const updateStatus = async (status: ReservationStatus, cancelComment?: string) => {
    if (!selected) return;
    setWorking(true);
    setActionError("");
    try {
      const updated = await api<ReservationDetail>(`/reservations/${selected.id}`, {
        method: "PATCH",
        json: { status, ...(cancelComment ? { cancel_comment: cancelComment } : {}) },
      });
      await load();
      setSelected(updated);
      setReasonMode(false);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setWorking(false);
    }
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setWorking(true);
    setActionError("");
    try {
      const updated = await api<ReservationDetail>(`/reservations/${selected.id}`, {
        method: "PATCH",
        json: {
          start_date: editStartDate,
          end_date: editEndDate,
          phone: editPhone.trim() || null,
          deposit_type: editDepositType || null,
          total_deposit: Number(editTotalDeposit),
          comments: editComments.trim() || null,
          staff_comment: editStaffComment.trim() || null,
        },
      });
      await load();
      setSelected(updated);
      setEditMode(false);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("loans.title")}</h1>
          <p className="page-head__sub">{t("loans.subtitle")}</p>
        </div>
      </div>

      <div className="filters">
        <div className="filters__row">
          <div className="input-icon">
            <Search size={18} />
            <input
              type="search"
              className="input"
              placeholder={t("loans.search_placeholder")}
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
            aria-pressed={tab === null}
            onClick={() => setTab(null)}
          >
            {t("loans.tab_all")}
            <span className="chip__count">{loans.length}</span>
          </button>
          {TABS.map((status) => (
            <button
              key={status}
              type="button"
              className="chip"
              aria-pressed={tab === status}
              onClick={() => setTab(status)}
            >
              {t(`status.${status}`)}
              <span className="chip__count">{counts.get(status) ?? 0}</span>
            </button>
          ))}
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
          <ClipboardList size={40} />
          <h2>{t("loans.empty_title")}</h2>
          <p>{t("loans.empty_text")}</p>
        </div>
      ) : (
        <div className="list">
          {visible.map((loan) => (
            <button key={loan.id} type="button" className="row" onClick={() => openDetail(loan)}>
              <span className="row__main">
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="row__title">
                    {loan.user.display_name}
                    <StatusBadge status={loan.status} />
                    {loan.staff_comment && (
                      <span className="badge badge--pending inline" style={{ gap: 4, fontSize: 11 }}>
                        <Lock size={11} /> {t("loans.has_staff_comment")}
                      </span>
                    )}
                  </span>
                  <span className="row__sub truncate">{loan.user.email}</span>
                </span>
              </span>
              <span className="row__aside">
                <span className="muted nowrap">
                  {formatDate(loan.start_date, locale)} → {formatDate(loan.end_date, locale)}
                </span>
                <span className="tag">{tn("catalogue.results", loan.items.length)}</span>
                <strong className="nowrap">{formatMoney(loan.total_deposit, locale)}</strong>
                <ChevronRight size={18} color="var(--ink-soft)" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Modal Détail / Édition du prêt */}
      <Modal
        open={selected !== null}
        onClose={closeDetail}
        title={
          editMode
            ? t("loans.edit_title")
            : reasonMode
              ? t("loans.cancel_title")
              : t("loans.detail_title")
        }
        wide
        footer={
          selected && !reasonMode && !editMode ? (
            <div className="inline" style={{ justifyContent: "space-between", width: "100%" }}>
              <div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={openEdit}>
                  <Pencil size={16} />
                  {t("loans.edit_loan")}
                </button>
              </div>
              <div className="inline" style={{ gap: 8 }}>
                {selected.status === "active" && (
                  <>
                    <button
                      type="button"
                      className="btn btn--danger-soft"
                      disabled={working}
                      onClick={() => setReasonMode(true)}
                    >
                      <X size={18} />
                      {t("loans.refuse")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={working}
                      onClick={() => updateStatus("approved")}
                    >
                      <Check size={18} />
                      {t("loans.approve")}
                    </button>
                  </>
                )}
                {selected.status === "approved" && (
                  <>
                    <button
                      type="button"
                      className="btn btn--danger-soft"
                      disabled={working}
                      onClick={() => setReasonMode(true)}
                    >
                      <AlertCircle size={18} />
                      {t("loans.report")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--accent"
                      disabled={working}
                      onClick={() => updateStatus("returned")}
                    >
                      <Undo2 size={18} />
                      {t("loans.mark_returned")}
                    </button>
                  </>
                )}
                {(selected.status === "returned" || selected.status === "cancelled") && (
                  <button type="button" className="btn btn--ghost" onClick={closeDetail}>
                    {t("app.close")}
                  </button>
                )}
              </div>
            </div>
          ) : editMode ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setEditMode(false)}>
                {t("app.cancel")}
              </button>
              <button
                type="submit"
                form="loan-edit-form"
                className="btn btn--primary"
                disabled={working}
              >
                {working ? t("app.saving") : t("app.save")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setReasonMode(false)}>
                {t("app.back")}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={working || reason.trim() === ""}
                onClick={() => updateStatus("cancelled", reason.trim())}
              >
                {t("loans.cancel_confirm")}
              </button>
            </>
          )
        }
      >
        {selected && (
          <div className="dialog__body">
            {editMode ? (
              /* FORMULAIRE D'ÉDITION DU PRÊT */
              <form id="loan-edit-form" onSubmit={saveEdit} className="stack stack--md">
                <div className="form-grid form-grid--2">
                  <label className="field">
                    <span className="field__label">
                      <Calendar size={15} />
                      {t("reservation.start")} *
                    </span>
                    <input
                      type="date"
                      className="input"
                      required
                      value={editStartDate}
                      onChange={(event) => setEditStartDate(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">
                      <Calendar size={15} />
                      {t("reservation.end")} *
                    </span>
                    <input
                      type="date"
                      className="input"
                      required
                      value={editEndDate}
                      min={editStartDate}
                      onChange={(event) => setEditEndDate(event.target.value)}
                    />
                  </label>
                </div>

                <div className="form-grid form-grid--2">
                  <label className="field">
                    <span className="field__label">
                      <Phone size={15} />
                      {t("reservation.phone")}
                    </span>
                    <input
                      type="tel"
                      className="input"
                      value={editPhone}
                      placeholder="06 12 34 56 78"
                      onChange={(event) => setEditPhone(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">
                      <Wallet size={15} />
                      {t("reservation.deposit_type")}
                    </span>
                    <select
                      className="select"
                      value={editDepositType}
                      onChange={(event) => setEditDepositType(event.target.value)}
                    >
                      {settings.deposit_types.map((tp) => (
                        <option key={tp} value={tp}>
                          {tp}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">
                    <Wallet size={15} />
                    {t("reservations.deposit")} (€)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    value={editTotalDeposit}
                    onChange={(event) => setEditTotalDeposit(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="field__label">
                    <MessageSquare size={15} />
                    {t("loans.student_comment")} <span className="opt">(visible par l'étudiant)</span>
                  </span>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={editComments}
                    placeholder="Commentaire de l'étudiant…"
                    onChange={(event) => setEditComments(event.target.value)}
                  />
                </label>

                <div
                  className="stack stack--sm"
                  style={{
                    background: "rgba(72, 188, 188, 0.08)",
                    border: "1px solid var(--accent)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px",
                  }}
                >
                  <label className="field">
                    <span className="field__label" style={{ color: "var(--primary-deep)", fontWeight: 600 }}>
                      <Lock size={15} color="var(--primary-deep)" />
                      {t("loans.staff_comment")}
                    </span>
                    <p className="field__hint" style={{ color: "var(--ink-soft)" }}>
                      {t("loans.staff_comment_hint")}
                    </p>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={editStaffComment}
                      placeholder={t("loans.staff_comment_placeholder")}
                      onChange={(event) => setEditStaffComment(event.target.value)}
                    />
                  </label>
                </div>
              </form>
            ) : reasonMode ? (
              /* FORMULAIRE D'ANNULATION */
              <>
                <p className="muted">{t("loans.cancel_text")}</p>
                <label className="field">
                  <span className="field__label">{t("loans.cancel_reason")}</span>
                  <textarea
                    className="textarea"
                    rows={4}
                    autoFocus
                    value={reason}
                    placeholder={t("loans.cancel_placeholder")}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
              </>
            ) : (
              /* CONSULTATION DU PRÊT */
              <>
                <div className="kv-grid">
                  <div className="kv">
                    <span className="kv__k">{t("loans.borrower")}</span>
                    <span className="kv__v">{selected.user.display_name}</span>
                    <span className="muted">{selected.user.email}</span>
                    {selected.phone && <span className="muted">{selected.phone}</span>}
                  </div>
                  <div className="kv">
                    <span className="kv__k">{t("loans.period")}</span>
                    <span className="kv__v">
                      {formatDate(selected.start_date, locale)} →{" "}
                      {formatDate(selected.end_date, locale)}
                    </span>
                    <span className="muted">
                      {t("loans.requested_on")} {formatDateTime(selected.created_at, locale)}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="kv__k">{t("loans.deposit")}</span>
                    <span className="kv__v strong">
                      {formatMoney(selected.total_deposit, locale)}
                    </span>
                    <span className="muted">{selected.deposit_type || "—"}</span>
                  </div>
                </div>

                <div className="stack stack--sm">
                  <p className="section-title">{t("loans.items")}</p>
                  <ul className="stack stack--sm" style={{ listStyle: "none" }}>
                    {selected.items.map((item) => (
                      <li key={item.id} className="cart-item">
                        <span className="cart-item__text">
                          <span className="cart-item__name">{item.equipment.name}</span>
                          <span className="cart-item__meta">
                            #{item.equipment.label} ·{" "}
                            {item.equipment.category?.name ?? t("catalogue.no_category")}
                          </span>
                        </span>
                        <span className="muted nowrap">
                          {item.equipment.deposit_amount
                            ? formatMoney(item.equipment.deposit_amount, locale)
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Commentaire de l'étudiant */}
                {selected.comments && (
                  <p className="quote">
                    <span className="kv__k">{t("loans.student_comment")}</span>
                    <br />
                    {selected.comments}
                  </p>
                )}

                {/* NOTE INTERNE DU MANDAT (PRIVÉE) */}
                {selected.staff_comment && (
                  <div
                    style={{
                      background: "rgba(72, 188, 188, 0.1)",
                      border: "1px solid var(--accent)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                    }}
                  >
                    <span
                      className="inline"
                      style={{
                        gap: 6,
                        color: "var(--primary-deep)",
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <Lock size={14} />
                      {t("loans.staff_comment")}
                      <span className="tag" style={{ fontSize: 11 }}>
                        Privé Mandat
                      </span>
                    </span>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--ink)" }}>
                      {selected.staff_comment}
                    </p>
                  </div>
                )}

                {selected.cancel_comment && (
                  <p className="alert alert--error">
                    <AlertCircle size={18} />
                    <span>
                      <strong>{t("loans.cancel_reason")} : </strong>
                      {selected.cancel_comment}
                    </span>
                  </p>
                )}

                {selected.returned_at && selected.returned_by_user && (
                  <p className="muted">
                    {t("loans.returned_by", {
                      name: selected.returned_by_user.display_name,
                      date: formatDate(selected.returned_at, locale),
                    })}
                  </p>
                )}
              </>
            )}

            {actionError && (
              <p className="alert alert--error">
                <AlertCircle size={18} />
                <span>{actionError}</span>
              </p>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
