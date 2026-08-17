"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, CheckCircle2, MessageSquare, Phone, Wallet } from "lucide-react";
import Modal from "./Modal";
import { useCart } from "./CartProvider";
import { useTranslation } from "./I18nProvider";
import { useSession } from "./SessionProvider";
import { ApiError, api } from "../lib/api";
import { addDaysIso, dayCount, formatDate, formatMoney, todayIso } from "../lib/format";
import { Reservation } from "../lib/types";

/**
 * Dernière étape de la réservation : dates, caution, récapitulatif.
 * Rendue une seule fois dans le gabarit ; ouverte par la colonne ou la barre
 * de sélection.
 */
export default function ReservationDialog() {
  const { t, tn, locale } = useTranslation();
  const { user, settings } = useSession();
  const { items, total, checkoutOpen, closeCheckout, clear } = useCart();

  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [phone, setPhone] = useState("");
  const [comments, setComments] = useState("");
  const [depositType, setDepositType] = useState(settings.deposit_types[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Reservation | null>(null);

  // Chaque ouverture repart d'un formulaire propre.
  useEffect(() => {
    if (!checkoutOpen) return;
    const today = todayIso();
    setStart(today);
    setEnd(today);
    setPhone("");
    setComments("");
    setDepositType(settings.deposit_types[0] ?? "");
    setError("");
    setDone(null);
  }, [checkoutOpen, settings.deposit_types]);

  // La durée maximale est comptée en jours inclus, comme celle affichée.
  const maxEnd = addDaysIso(start, Math.max(settings.max_reservation_days - 1, 0));
  const maxStart =
    settings.max_advance_days > 0 ? addDaysIso(todayIso(), settings.max_advance_days) : undefined;
  const duration = dayCount(start, end);

  const handleStartChange = (value: string) => {
    setStart(value);
    if (value > end) setEnd(value);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (end < start) {
      setError(t("reservation.invalid_dates"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const reservation = await api<Reservation>("/reservations", {
        method: "POST",
        json: {
          start_date: start,
          end_date: end,
          phone: phone.trim() || null,
          comments: comments.trim() || null,
          deposit_type: depositType || null,
          items: items.map((item) => item.id),
        },
      });
      setDone(reservation);
      clear();
    } catch (caught) {
      const message =
        caught instanceof ApiError && caught.status === 0
          ? t("app.error_network")
          : caught instanceof Error
            ? caught.message
            : t("app.error_generic");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={checkoutOpen && (items.length > 0 || done !== null)}
      onClose={closeCheckout}
      title={done ? t("reservation.success_title") : t("reservation.title")}
      footer={
        done ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={closeCheckout}>
              {t("app.close")}
            </button>
            <Link href="/mes-reservations" className="btn btn--primary" onClick={closeCheckout}>
              {t("reservation.see_reservations")}
            </Link>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={closeCheckout}>
              {t("app.cancel")}
            </button>
            <button
              type="submit"
              form="reservation-form"
              className="btn btn--primary"
              disabled={submitting}
            >
              {submitting ? t("reservation.submitting") : t("reservation.submit")}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="dialog__body">
          <div className="alert alert--ok">
            <CheckCircle2 size={18} />
            <span>{t("reservation.success_text")}</span>
          </div>

          <div className="kv-grid">
            <div className="kv">
              <span className="kv__k">{t("reservation.borrower")}</span>
              <span className="kv__v">{user?.display_name}</span>
            </div>
            <div className="kv">
              <span className="kv__k">{t("reservation.period")}</span>
              <span className="kv__v">
                {formatDate(done.start_date, locale)} → {formatDate(done.end_date, locale)}
              </span>
            </div>
            <div className="kv">
              <span className="kv__k">{t("reservations.deposit")}</span>
              <span className="kv__v strong">{formatMoney(done.total_deposit, locale)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">{t("reservations.deposit_method")}</span>
              <span className="kv__v">{done.deposit_type || "—"}</span>
            </div>
          </div>

          <ul className="stack stack--sm" style={{ listStyle: "none" }}>
            {done.items.map((item) => (
              <li key={item.id} className="cart-item">
                <span className="cart-item__text">
                  <span className="cart-item__name">{item.equipment.name}</span>
                  <span className="cart-item__meta">#{item.equipment.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form id="reservation-form" className="dialog__body" onSubmit={submit}>
          <div className="stack stack--sm">
            <p className="section-title">
              <CalendarDays size={15} />
              {t("reservation.period")}
            </p>
            <div className="form-grid form-grid--2">
              <label className="field">
                <span className="field__label">{t("reservation.start")}</span>
                <input
                  type="date"
                  className="input"
                  required
                  value={start}
                  min={todayIso()}
                  max={maxStart}
                  onChange={(event) => handleStartChange(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">{t("reservation.end")}</span>
                <input
                  type="date"
                  className="input"
                  required
                  value={end}
                  min={start}
                  max={maxEnd}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>
            <p className="field__hint">
              {tn("reservation.duration", duration)} ·{" "}
              {t("reservation.max_duration", { days: settings.max_reservation_days })}
              {settings.max_advance_days > 0
                ? ` ${t("reservation.max_advance", { days: settings.max_advance_days })}`
                : ""}
            </p>
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">
                <Wallet size={15} />
                {t("reservation.deposit_type")}
              </span>
              <select
                className="select"
                value={depositType}
                onChange={(event) => setDepositType(event.target.value)}
              >
                {settings.deposit_types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">
                <Phone size={15} />
                {t("reservation.phone")}
                {settings.require_phone ? (
                  <span className="req">*</span>
                ) : (
                  <span className="opt">({t("app.optional")})</span>
                )}
              </span>
              <input
                type="tel"
                className="input"
                required={settings.require_phone}
                value={phone}
                placeholder="06 12 34 56 78"
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">
              <MessageSquare size={15} />
              {t("reservation.comments")}
              {settings.require_comments ? (
                <span className="req">*</span>
              ) : (
                <span className="opt">({t("app.optional")})</span>
              )}
            </span>
            <textarea
              className="textarea"
              rows={3}
              required={settings.require_comments}
              value={comments}
              placeholder={t("reservation.comments_placeholder")}
              onChange={(event) => setComments(event.target.value)}
            />
          </label>

          <div className="stack stack--sm">
            <p className="section-title">{t("reservation.recap")}</p>
            <ul className="stack stack--sm" style={{ listStyle: "none" }}>
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  <span className="cart-item__text">
                    <span className="cart-item__name">{item.name}</span>
                    <span className="cart-item__meta">#{item.label}</span>
                  </span>
                  <span className="muted nowrap">
                    {item.deposit_amount
                      ? formatMoney(item.deposit_amount, locale)
                      : t("catalogue.no_deposit")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="cart-total">
              <span>
                {t("cart.total")}
                <br />
                <span style={{ fontSize: 13, opacity: 0.8 }}>{user?.display_name}</span>
              </span>
              <span className="cart-total__value">{formatMoney(total, locale)}</span>
            </div>
          </div>

          {error && (
            <p className="alert alert--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
