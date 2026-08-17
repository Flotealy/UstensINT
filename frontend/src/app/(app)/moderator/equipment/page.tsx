"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, ChevronRight, ImageOff, Plus, Search } from "lucide-react";
import EquipmentEditor from "../../../components/EquipmentEditor";
import { useTranslation } from "../../../components/I18nProvider";
import { ApiError, api } from "../../../lib/api";
import { fold, formatMoney } from "../../../lib/format";
import { Category, EquipmentDetail, isReservable, photoOf } from "../../../lib/types";

export default function ManageEquipmentPage() {
  const { t, locale } = useTranslation();

  const [items, setItems] = useState<EquipmentDetail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const [equipment, cats] = await Promise.all([
        api<EquipmentDetail[]>("/equipment/admin?include_archived=true"),
        api<Category[]>("/categories"),
      ]);
      setItems(equipment);
      setCategories(cats);
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
    const needle = fold(search);
    return items.filter((item) => {
      if (!showArchived && item.is_archived) return false;
      if (categoryId && (item.category?.id ?? "") !== categoryId) return false;
      if (!needle) return true;
      return (
        fold(item.name).includes(needle) ||
        fold(item.label).includes(needle) ||
        fold(item.location ?? "").includes(needle)
      );
    });
  }, [items, search, categoryId, showArchived]);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (item: EquipmentDetail) => {
    setEditing(item);
    setEditorOpen(true);
  };

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("equipment.title")}</h1>
          <p className="page-head__sub">{t("equipment.subtitle")}</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} />
            {t("equipment.add")}
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filters__row">
          <div className="input-icon">
            <Search size={18} />
            <input
              type="search"
              className="input"
              placeholder={t("equipment.search_placeholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("app.search")}
            />
          </div>
        </div>
        <div className="inline" style={{ justifyContent: "space-between", gap: 12 }}>
          <select
            className="select"
            style={{ maxWidth: 260 }}
            value={categoryId}
            aria-label={t("equipment.field_category")}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t("equipment.all_categories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="switch">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span className="switch__track">
              <span className="switch__thumb" />
            </span>
            {t("equipment.show_archived")}
          </label>
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
          <Boxes size={40} />
          <h2>{t("equipment.empty_title")}</h2>
          <p>{t("equipment.empty_text")}</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
            <Plus size={16} />
            {t("equipment.add")}
          </button>
        </div>
      ) : (
        <div className="list">
          {visible.map((item) => {
            const photo = photoOf(item);
            return (
              <button key={item.id} type="button" className="row" onClick={() => openEdit(item)}>
                <span className="row__main">
                  <span className="thumb">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                      />
                    ) : (
                      <ImageOff size={18} />
                    )}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="row__title">
                      {item.name}
                      {item.is_archived && (
                        <span className="badge badge--muted">{t("equipment.archived")}</span>
                      )}
                    </span>
                    <span className="row__sub truncate">
                      #{item.label} · {item.category?.name ?? t("catalogue.no_category")}
                      {item.location ? ` · ${item.location}` : ""}
                    </span>
                  </span>
                </span>
                <span className="row__aside">
                  <span className={`badge ${isReservable(item) ? "badge--muted" : "badge--danger"}`}>
                    {item.status}
                  </span>
                  <strong className="nowrap">
                    {item.deposit_amount
                      ? formatMoney(item.deposit_amount, locale)
                      : t("catalogue.no_deposit")}
                  </strong>
                  <ChevronRight size={18} color="var(--ink-soft)" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <EquipmentEditor
        open={editorOpen}
        equipment={editing}
        categories={categories}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />
    </main>
  );
}
