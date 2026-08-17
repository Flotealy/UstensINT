"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  MapPin,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Modal from "../../../components/Modal";
import { useTranslation } from "../../../components/I18nProvider";
import { ApiError, api } from "../../../lib/api";
import { fold, formatDate } from "../../../lib/format";
import { StockItem } from "../../../lib/types";

const STATUS_OPTIONS = [
  "Frais",
  "Bon état",
  "Entamé",
  "À consommer rapidement",
  "Périmé",
  "À réapprovisionner",
];

const CATEGORY_OPTIONS = [
  "Nourriture",
  "Épices & Condiments",
  "Boissons",
  "Consommables",
  "Matériel Club",
  "Autre",
];

export default function StockPage() {
  const { t, locale } = useTranslation();

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Nourriture");
  const [quantity, setQuantity] = useState("");
  const [itemStatus, setItemStatus] = useState("Bon état");
  const [location, setLocation] = useState("");
  const [comments, setComments] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  // Delete Modal State
  const [deleting, setDeleting] = useState<StockItem | null>(null);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api<StockItem[]>("/stock"));
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
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.status, (map.get(item.status) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const needle = fold(search);
    return items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        fold(item.name).includes(needle) ||
        fold(item.location ?? "").includes(needle) ||
        fold(item.category ?? "").includes(needle) ||
        fold(item.comments ?? "").includes(needle)
      );
    });
  }, [items, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCategory("Nourriture");
    setQuantity("");
    setItemStatus("Bon état");
    setLocation("");
    setComments("");
    setExpirationDate("");
    setFormError("");
    setEditorOpen(true);
  };

  const openEdit = (item: StockItem) => {
    setEditing(item);
    setName(item.name);
    setCategory(item.category ?? "Nourriture");
    setQuantity(item.quantity);
    setItemStatus(item.status);
    setLocation(item.location ?? "");
    setComments(item.comments ?? "");
    setExpirationDate(item.expiration_date ?? "");
    setFormError("");
    setEditorOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setFormError("");
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      quantity: quantity.trim(),
      status: itemStatus,
      location: location.trim() || null,
      comments: comments.trim() || null,
      expiration_date: expirationDate ? expirationDate : null,
    };
    try {
      if (editing) {
        await api(`/stock/${editing.id}`, { method: "PATCH", json: payload });
      } else {
        await api("/stock", { method: "POST", json: payload });
      }
      await load();
      setEditorOpen(false);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setWorking(true);
    setFormError("");
    try {
      await api(`/stock/${deleting.id}`, { method: "DELETE" });
      await load();
      setDeleting(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setWorking(false);
    }
  };

  const badgeClass = (st: string) => {
    if (st === "Frais" || st === "Bon état") return "badge badge--approved";
    if (st === "À consommer rapidement" || st === "Entamé") return "badge badge--pending";
    if (st === "Périmé" || st === "À réapprovisionner") return "badge badge--danger";
    return "badge badge--muted";
  };

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("stock.title")}</h1>
          <p className="page-head__sub">{t("stock.subtitle")}</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Plus size={18} />
            {t("stock.add")}
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
              placeholder={t("stock.search_placeholder")}
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
            aria-pressed={statusFilter === null}
            onClick={() => setStatusFilter(null)}
          >
            {t("loans.tab_all")}
            <span className="chip__count">{items.length}</span>
          </button>
          {STATUS_OPTIONS.filter((st) => (counts.get(st) ?? 0) > 0).map((st) => (
            <button
              key={st}
              type="button"
              className="chip"
              aria-pressed={statusFilter === st}
              onClick={() => setStatusFilter(statusFilter === st ? null : st)}
            >
              {st}
              <span className="chip__count">{counts.get(st) ?? 0}</span>
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
          <PackageOpen size={44} />
          <h2>{t("stock.empty_title")}</h2>
          <p>{t("stock.empty_text")}</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
            <Plus size={16} />
            {t("stock.add")}
          </button>
        </div>
      ) : (
        <div className="list">
          {visible.map((item) => (
            <div key={item.id} className="row">
              <span className="row__main">
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="row__title">
                    {item.name}
                    <span className="tag">{item.quantity}</span>
                    <span className={badgeClass(item.status)}>{item.status}</span>
                  </span>
                  <span className="row__sub inline" style={{ gap: 12, marginTop: 4 }}>
                    {item.category && <span>{item.category}</span>}
                    {item.location && (
                      <span className="inline" style={{ gap: 4 }}>
                        <MapPin size={13} /> {item.location}
                      </span>
                    )}
                    {item.expiration_date && (
                      <span className="inline" style={{ gap: 4, color: "var(--danger)" }}>
                        <Calendar size={13} /> DLC : {formatDate(item.expiration_date, locale)}
                      </span>
                    )}
                  </span>
                  {item.comments && (
                    <span className="row__sub truncate" style={{ fontStyle: "italic" }}>
                      « {item.comments} »
                    </span>
                  )}
                </span>
              </span>

              <span className="row__actions">
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => openEdit(item)}
                  aria-label={`${t("app.edit")} — ${item.name}`}
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon is-danger"
                  onClick={() => {
                    setDeleting(item);
                    setFormError("");
                  }}
                  aria-label={`${t("app.delete")} — ${item.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal d'édition/création */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? t("stock.edit") : t("stock.add")}
        wide
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditorOpen(false)}>
              {t("app.cancel")}
            </button>
            <button
              type="submit"
              form="stock-form"
              className="btn btn--primary"
              disabled={working}
            >
              {working ? t("app.saving") : t("app.save")}
            </button>
          </>
        }
      >
        <form id="stock-form" className="dialog__body" onSubmit={save}>
          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">{t("stock.field_name")} *</span>
              <input
                type="text"
                className="input"
                required
                autoFocus
                value={name}
                placeholder={t("stock.field_name_placeholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">{t("stock.field_quantity")} *</span>
              <input
                type="text"
                className="input"
                required
                value={quantity}
                placeholder={t("stock.field_quantity_placeholder")}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">{t("stock.field_category")}</span>
              <select
                className="select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">{t("stock.field_status")}</span>
              <select
                className="select"
                value={itemStatus}
                onChange={(event) => setItemStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">
                {t("stock.field_location")} <span className="opt">({t("app.optional")})</span>
              </span>
              <input
                type="text"
                className="input"
                value={location}
                placeholder={t("stock.field_location_placeholder")}
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">
                {t("stock.field_expiration")} <span className="opt">({t("app.optional")})</span>
              </span>
              <input
                type="date"
                className="input"
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">
              {t("stock.field_comments")} <span className="opt">({t("app.optional")})</span>
            </span>
            <textarea
              className="textarea"
              rows={3}
              value={comments}
              placeholder={t("stock.field_comments_placeholder")}
              onChange={(event) => setComments(event.target.value)}
            />
          </label>

          {formError && (
            <p className="alert alert--error">
              <AlertCircle size={18} />
              <span>{formError}</span>
            </p>
          )}
        </form>
      </Modal>

      {/* Modal de suppression */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("stock.delete_title")}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDeleting(null)}>
              {t("app.cancel")}
            </button>
            <button type="button" className="btn btn--danger" disabled={working} onClick={remove}>
              {t("app.delete")}
            </button>
          </>
        }
      >
        <div className="dialog__body">
          <p>
            <strong>{deleting?.name}</strong> ({deleting?.quantity})
          </p>
          <p className="muted">{t("stock.delete_text")}</p>
          {formError && (
            <p className="alert alert--error">
              <AlertCircle size={18} />
              <span>{formError}</span>
            </p>
          )}
        </div>
      </Modal>
    </main>
  );
}
