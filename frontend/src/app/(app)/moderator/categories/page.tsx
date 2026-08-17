"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import Modal from "../../../components/Modal";
import { useTranslation } from "../../../components/I18nProvider";
import { ApiError, api } from "../../../lib/api";
import { Category, EquipmentDetail } from "../../../lib/types";

export default function CategoriesPage() {
  const { t, tn } = useTranslation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      const [cats, items] = await Promise.all([
        api<Category[]>("/categories"),
        api<EquipmentDetail[]>("/equipment/admin?include_archived=true"),
      ]);
      setCategories(cats);
      setEquipment(items);
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
    for (const item of equipment) {
      if (item.category) map.set(item.category.id, (map.get(item.category.id) ?? 0) + 1);
    }
    return map;
  }, [equipment]);

  const openEditor = (category: Category | null) => {
    setEditing(category);
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setFormError("");
    setEditorOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setFormError("");
    const payload = { name: name.trim(), description: description.trim() || null };
    try {
      if (editing) {
        await api(`/categories/${editing.id}`, { method: "PATCH", json: payload });
      } else {
        await api("/categories", { method: "POST", json: payload });
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
      await api(`/categories/${deleting.id}`, { method: "DELETE" });
      await load();
      setDeleting(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : t("app.error_generic"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("categories.title")}</h1>
          <p className="page-head__sub">{t("categories.subtitle")}</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--primary" onClick={() => openEditor(null)}>
            <Plus size={18} />
            {t("categories.add")}
          </button>
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
      ) : categories.length === 0 ? (
        <div className="card empty">
          <Tags size={40} />
          <h2>{t("categories.empty_title")}</h2>
          <p>{t("categories.empty_text")}</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => openEditor(null)}>
            <Plus size={16} />
            {t("categories.add")}
          </button>
        </div>
      ) : (
        <div className="list">
          {categories.map((category) => (
            <div key={category.id} className="row">
              <span className="row__main">
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="row__title">
                    {category.name}
                    <span className="tag">{tn("categories.count", counts.get(category.id) ?? 0)}</span>
                  </span>
                  {category.description && <span className="row__sub truncate">{category.description}</span>}
                </span>
              </span>
              <span className="row__actions">
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => openEditor(category)}
                  aria-label={`${t("app.edit")} — ${category.name}`}
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon is-danger"
                  onClick={() => {
                    setDeleting(category);
                    setFormError("");
                  }}
                  aria-label={`${t("app.delete")} — ${category.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? t("categories.edit") : t("categories.add")}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditorOpen(false)}>
              {t("app.cancel")}
            </button>
            <button type="submit" form="category-form" className="btn btn--primary" disabled={working}>
              {working ? t("app.saving") : t("app.save")}
            </button>
          </>
        }
      >
        <form id="category-form" className="dialog__body" onSubmit={save}>
          <label className="field">
            <span className="field__label">{t("categories.field_name")}</span>
            <input
              type="text"
              className="input"
              required
              autoFocus
              value={name}
              placeholder={t("categories.field_name_placeholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">
              {t("categories.field_description")}{" "}
              <span className="opt">({t("app.optional")})</span>
            </span>
            <textarea
              className="textarea"
              rows={2}
              value={description}
              placeholder={t("categories.field_description_placeholder")}
              onChange={(event) => setDescription(event.target.value)}
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

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("categories.delete_title")}
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
            <strong>{deleting?.name}</strong>
          </p>
          <p className="muted">{t("categories.delete_text")}</p>
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
