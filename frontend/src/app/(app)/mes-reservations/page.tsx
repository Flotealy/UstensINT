"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarX2 } from "lucide-react";
import StatusBadge from "../../components/StatusBadge";
import { useTranslation } from "../../components/I18nProvider";
import { ApiError, api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import { Reservation, ReservationStatus } from "../../lib/types";

const STATUSES: ReservationStatus[] = ["active", "approved", "returned", "cancelled"];

export default function MyReservationsPage() {
  const { t, locale } = useTranslation();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ReservationStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    api<Reservation[]>("/reservations/me")
      .then((data) => !cancelled && setReservations(data))
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
  }, []);

  const counts = useMemo(() => {
    const map = new Map<ReservationStatus, number>();
    for (const reservation of reservations) {
      map.set(reservation.status, (map.get(reservation.status) ?? 0) + 1);
    }
    return map;
  }, [reservations]);

  const visible = filter
    ? reservations.filter((reservation) => reservation.status === filter)
    : reservations;

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("reservations.title")}</h1>
          <p className="page-head__sub">{t("reservations.subtitle")}</p>
        </div>
      </div>

      {reservations.length > 0 && (
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={filter === null}
            onClick={() => setFilter(null)}
          >
            {t("reservations.filter_all")}
            <span className="chip__count">{reservations.length}</span>
          </button>
          {STATUSES.filter((status) => counts.has(status)).map((status) => (
            <button
              key={status}
              type="button"
              className="chip"
              aria-pressed={filter === status}
              onClick={() => setFilter(filter === status ? null : status)}
            >
              {t(`status.${status}`)}
              <span className="chip__count">{counts.get(status)}</span>
            </button>
          ))}
        </div>
      )}

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
          <CalendarX2 size={40} />
          <h2>{t("reservations.empty_title")}</h2>
          <p>
            {reservations.length === 0
              ? t("reservations.empty_text")
              : t("reservations.empty_filtered")}
          </p>
          {reservations.length === 0 && (
            <Link href="/" className="btn btn--primary btn--sm">
              {t("reservations.go_catalogue")}
            </Link>
          )}
        </div>
      ) : (
        <div className="stack">
          {visible.map((reservation) => (
            <article key={reservation.id} className="card card--pad stack">
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <span className="inline">
                  <StatusBadge status={reservation.status} />
                  <strong>
                    {formatDate(reservation.start_date, locale)} →{" "}
                    {formatDate(reservation.end_date, locale)}
                  </strong>
                </span>
                <span className="muted">
                  {t("reservations.requested_on", {
                    date: formatDate(reservation.created_at, locale),
                  })}
                </span>
              </div>

              <hr className="divider" />

              <div className="kv-grid">
                <div className="kv">
                  <span className="kv__k">{t("reservations.items")}</span>
                  <ul className="kv__v" style={{ listStyle: "none" }}>
                    {reservation.items.map((item) => (
                      <li key={item.id}>
                        {item.equipment.name}{" "}
                        <span className="muted">#{item.equipment.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="kv">
                  <span className="kv__k">{t("reservations.deposit")}</span>
                  <span className="kv__v strong">
                    {formatMoney(reservation.total_deposit, locale)}
                  </span>
                  {reservation.deposit_type && (
                    <span className="muted">{reservation.deposit_type}</span>
                  )}
                </div>
                {reservation.returned_at && (
                  <div className="kv">
                    <span className="kv__k">{t("status.returned")}</span>
                    <span className="kv__v">
                      {t("reservations.returned_on", {
                        date: formatDate(reservation.returned_at, locale),
                      })}
                    </span>
                  </div>
                )}
              </div>

              {reservation.comments && (
                <p className="quote">
                  <span className="kv__k">{t("reservations.your_comment")}</span>
                  <br />
                  {reservation.comments}
                </p>
              )}

              {reservation.cancel_comment && (
                <p className="alert alert--error">
                  <AlertCircle size={18} />
                  <span>
                    <strong>{t("reservations.cancel_reason")} : </strong>
                    {reservation.cancel_comment}
                  </span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
