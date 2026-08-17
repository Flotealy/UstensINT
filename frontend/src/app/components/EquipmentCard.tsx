"use client";

import { Check, ImageOff } from "lucide-react";
import { useTranslation } from "./I18nProvider";
import { formatMoney } from "../lib/format";
import { Equipment, isReservable, photoOf } from "../lib/types";

/** Carte du catalogue : la carte entière est le bouton de sélection. */
export default function EquipmentCard({
  equipment,
  selected,
  blockingStatuses,
  onToggle,
}: {
  equipment: Equipment;
  selected: boolean;
  blockingStatuses?: string[];
  onToggle: () => void;
}) {
  const { t, locale } = useTranslation();
  const photo = photoOf(equipment);
  const available = isReservable(equipment, blockingStatuses);

  return (
    <button
      type="button"
      className="eq"
      aria-pressed={selected}
      disabled={!available}
      onClick={onToggle}
    >
      <span className="eq__media">
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <ImageOff size={26} aria-label={t("catalogue.no_photo")} />
        )}
        <span className={`badge eq__status ${available ? "badge--muted" : "badge--danger"}`}>
          {equipment.status}
        </span>
        {selected && (
          <span className="eq__check">
            <Check size={16} strokeWidth={3} />
          </span>
        )}
      </span>

      <span className="eq__body">
        <span className="eq__name">{equipment.name}</span>
        <span className="eq__meta">
          <span className="tag">#{equipment.label}</span>
          <span className="truncate">
            {equipment.category?.name ?? t("catalogue.no_category")}
          </span>
        </span>
        <span className="eq__foot">
          <span className="eq__deposit">
            {equipment.deposit_amount
              ? formatMoney(equipment.deposit_amount, locale)
              : t("catalogue.no_deposit")}
          </span>
          <span className="eq__action">
            {!available
              ? t("catalogue.unavailable")
              : selected
                ? t("catalogue.selected")
                : t("catalogue.select")}
          </span>
        </span>
      </span>
    </button>
  );
}
