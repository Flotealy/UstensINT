"use client";

import { useTranslation } from "./I18nProvider";
import { ReservationStatus } from "../lib/types";

const MODIFIER: Record<ReservationStatus, string> = {
  active: "badge--pending",
  approved: "badge--approved",
  returned: "badge--returned",
  cancelled: "badge--cancelled",
};

export default function StatusBadge({ status }: { status: ReservationStatus }) {
  const { t } = useTranslation();
  return <span className={`badge ${MODIFIER[status] ?? ""}`}>{t(`status.${status}`)}</span>;
}
