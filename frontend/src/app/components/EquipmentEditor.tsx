"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Archive, ImageOff, Upload } from "lucide-react";
import Modal from "./Modal";
import { useTranslation } from "./I18nProvider";
import { useSession } from "./SessionProvider";
import { api, getToken } from "../lib/api";
import { Category, EquipmentDetail, photoOf } from "../lib/types";

interface FormState {
  name: string;
  label: string;
  category_id: string;
  status: string;
  location: string;
  purchase_cost: string;
  deposit_amount: string;
  photo_url: string;
  comments: string;
}

function toForm(item: EquipmentDetail | null, defaultStatus: string): FormState {
  return {
    name: item?.name ?? "",
    label: item?.label ?? "",
    category_id: item?.category?.id ?? "",
    status: item?.status ?? defaultStatus,
    location: item?.location ?? "",
    purchase_cost: item?.purchase_cost != null ? String(item.purchase_cost) : "",
    deposit_amount: item?.deposit_amount != null ? String(item.deposit_amount) : "",
    photo_url: item?.photo_url ?? "",
    comments: item?.comments ?? "",
  };
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

/**
 * Création et modification d'un objet du catalogue (modérateur).
 * Le même formulaire sert aux deux cas ; l'archivage se fait en deuxième écran.
 */
export default function EquipmentEditor({
  open,
  equipment,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  equipment: EquipmentDetail | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { settings } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() =>
    toForm(equipment, settings.equipment_statuses[0] ?? "Bon état"),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(equipment, settings.equipment_statuses[0] ?? "Bon état"));
    setPhoto(equipment ? photoOf(equipment) : null);
    setError("");
    setArchiveMode(false);
    setArchiveReason("");
  }, [open, equipment, settings.equipment_statuses]);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      label: form.label.trim(),
      category_id: form.category_id || null,
      status: form.status,
      location: form.location.trim() || null,
      purchase_cost: numberOrNull(form.purchase_cost),
      deposit_amount: numberOrNull(form.deposit_amount),
      photo_url: form.photo_url.trim() || null,
      comments: form.comments.trim() || null,
    };
    try {
      if (equipment) {
        await api(`/equipment/${equipment.id}`, { method: "PATCH", json: payload });
      } else {
        await api("/equipment", { method: "POST", json: payload });
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!equipment) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      // FormData : on laisse le navigateur poser le Content-Type (boundary).
      const response = await fetch(`/api/equipment/${equipment.id}/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body,
      });
      if (!response.ok) throw new Error(t("app.error_generic"));
      const updated: EquipmentDetail = await response.json();
      setPhoto(photoOf(updated));
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const archive = async () => {
    if (!equipment) return;
    setSaving(true);
    setError("");
    try {
      await api(`/equipment/${equipment.id}/archive`, {
        method: "PATCH",
        json: { archive_comment: archiveReason.trim() },
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        archiveMode
          ? t("equipment.archive_title")
          : equipment
            ? t("equipment.edit")
            : t("equipment.add")
      }
      footer={
        archiveMode ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setArchiveMode(false)}>
              {t("app.back")}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={saving || archiveReason.trim() === ""}
              onClick={archive}
            >
              {t("equipment.archive_confirm")}
            </button>
          </>
        ) : (
          <>
            {equipment && !equipment.is_archived && (
              <button
                type="button"
                className="btn btn--danger-soft"
                onClick={() => setArchiveMode(true)}
              >
                <Archive size={18} />
                {t("equipment.archive")}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("app.cancel")}
            </button>
            <button type="submit" form="equipment-form" className="btn btn--primary" disabled={saving}>
              {saving ? t("app.saving") : equipment ? t("app.save") : t("equipment.create")}
            </button>
          </>
        )
      }
    >
      {archiveMode ? (
        <div className="dialog__body">
          <p className="muted">{t("equipment.archive_text")}</p>
          <label className="field">
            <span className="field__label">{t("equipment.archive_reason")}</span>
            <textarea
              className="textarea"
              rows={3}
              autoFocus
              value={archiveReason}
              placeholder={t("equipment.archive_reason_placeholder")}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
          </label>
          {error && (
            <p className="alert alert--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </p>
          )}
        </div>
      ) : (
        <form id="equipment-form" className="dialog__body" onSubmit={save}>
          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">{t("equipment.field_name")}</span>
              <input
                type="text"
                className="input"
                required
                autoFocus={!equipment}
                value={form.name}
                placeholder={t("equipment.field_name_placeholder")}
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">{t("equipment.field_label")}</span>
              <input
                type="text"
                className="input"
                required
                value={form.label}
                placeholder={t("equipment.field_label_placeholder")}
                onChange={(event) => update({ label: event.target.value })}
              />
              <span className="field__hint">{t("equipment.field_label_hint")}</span>
            </label>
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">{t("equipment.field_category")}</span>
              <select
                className="select"
                value={form.category_id}
                onChange={(event) => update({ category_id: event.target.value })}
              >
                <option value="">{t("equipment.field_category_none")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">{t("equipment.field_status")}</span>
              <select
                className="select"
                value={form.status}
                onChange={(event) => update({ status: event.target.value })}
              >
                {settings.equipment_statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
                {!settings.equipment_statuses.includes(form.status) && (
                  <option value={form.status}>{form.status}</option>
                )}
              </select>
              <span className="field__hint">{t("equipment.unreservable_note")}</span>
            </label>
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">
                {t("equipment.field_deposit")} <span className="opt">(€)</span>
              </span>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.deposit_amount}
                onChange={(event) => update({ deposit_amount: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">
                {t("equipment.field_purchase_cost")} <span className="opt">(€)</span>
              </span>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.purchase_cost}
                onChange={(event) => update({ purchase_cost: event.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">
              {t("equipment.field_location")} <span className="opt">({t("app.optional")})</span>
            </span>
            <input
              type="text"
              className="input"
              value={form.location}
              placeholder={t("equipment.field_location_placeholder")}
              onChange={(event) => update({ location: event.target.value })}
            />
          </label>

          <div className="stack stack--sm">
            <span className="section-title">{t("equipment.photo")}</span>
            <div className="inline" style={{ alignItems: "flex-start", gap: 12 }}>
              <span className="thumb" style={{ width: 64, height: 64 }}>
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                  />
                ) : (
                  <ImageOff size={20} />
                )}
              </span>
              <div className="field" style={{ flex: 1 }}>
                <input
                  type="url"
                  className="input"
                  value={form.photo_url}
                  placeholder="https://…"
                  aria-label={t("equipment.field_photo_url")}
                  onChange={(event) => update({ photo_url: event.target.value })}
                />
                {equipment && (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadPhoto(file);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={uploading}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload size={16} />
                      {uploading ? t("equipment.photo_uploading") : t("equipment.photo_upload")}
                    </button>
                    <span className="field__hint">{t("equipment.photo_hint")}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field__label">
              {t("equipment.field_comments")} <span className="opt">({t("app.optional")})</span>
            </span>
            <textarea
              className="textarea"
              rows={2}
              value={form.comments}
              placeholder={t("equipment.field_comments_placeholder")}
              onChange={(event) => update({ comments: event.target.value })}
            />
          </label>

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
