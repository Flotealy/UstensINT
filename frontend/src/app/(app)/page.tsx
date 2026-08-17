"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, PackageSearch, Search, X } from "lucide-react";
import CartPanel from "../components/CartPanel";
import EquipmentCard from "../components/EquipmentCard";
import { useCart } from "../components/CartProvider";
import { useTranslation } from "../components/I18nProvider";
import { useSession } from "../components/SessionProvider";
import { ApiError, api } from "../lib/api";
import { fold } from "../lib/format";
import { Category, Equipment } from "../lib/types";

export default function CataloguePage() {
  const { t, tn } = useTranslation();
  const { settings } = useSession();
  const cart = useCart();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Chargement unique au montage : le catalogue ne dépend d'aucun filtre serveur.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [items, cats] = await Promise.all([
          api<Equipment[]>("/equipment/public"),
          api<Category[]>("/categories"),
        ]);
        if (cancelled) return;
        setEquipment(items);
        setCategories(cats);
        // Un objet archivé entre-temps disparaît de la sélection.
        cart.sync(items);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof ApiError && caught.status === 0
            ? t("app.error_network")
            : t("app.error_generic"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Recherche appliquée avant le filtre de catégorie, pour compter les puces. */
  const searched = useMemo(() => {
    const needle = fold(search);
    if (!needle) return equipment;
    return equipment.filter(
      (item) => fold(item.name).includes(needle) || fold(item.label).includes(needle),
    );
  }, [equipment, search]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of searched) {
      const key = item.category?.id ?? "none";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [searched]);

  const visible = useMemo(
    () =>
      categoryId
        ? searched.filter((item) => (item.category?.id ?? "none") === categoryId)
        : searched,
    [searched, categoryId],
  );

  const filtered = search.trim() !== "" || categoryId !== null;
  const chips = [
    ...categories.map((category) => ({ id: category.id, name: category.name })),
    ...(counts.has("none") ? [{ id: "none", name: t("catalogue.no_category") }] : []),
  ].filter((chip) => (counts.get(chip.id) ?? 0) > 0 || chip.id === categoryId);

  return (
    <main className="content">
      <div className="page-head">
        <div className="page-head__text">
          <h1>{t("catalogue.title")}</h1>
          <p className="page-head__sub">{t("catalogue.subtitle")}</p>
        </div>
        {!loading && !error && (
          <p className="muted nowrap">{tn("catalogue.results", visible.length)}</p>
        )}
      </div>

      <div className="catalogue">
        <div className="stack stack--lg">
          <div className="filters">
            <div className="filters__row">
              <div className="input-icon">
                <Search size={18} />
                <input
                  type="search"
                  className="input"
                  placeholder={t("catalogue.search_placeholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={t("app.search")}
                />
                {search && (
                  <button
                    type="button"
                    className="input-icon__clear"
                    onClick={() => setSearch("")}
                    aria-label={t("catalogue.clear_search")}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {chips.length > 0 && (
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={categoryId === null}
                  onClick={() => setCategoryId(null)}
                >
                  {t("catalogue.all_categories")}
                  <span className="chip__count">{searched.length}</span>
                </button>
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="chip"
                    aria-pressed={categoryId === chip.id}
                    onClick={() => setCategoryId(categoryId === chip.id ? null : chip.id)}
                  >
                    {chip.name}
                    <span className="chip__count">{counts.get(chip.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error ? (
            <p className="alert alert--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </p>
          ) : loading ? (
            <div className="eq-grid" aria-busy="true">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="skeleton skeleton--card" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="card empty">
              <PackageSearch size={40} />
              <h2>{equipment.length === 0 ? t("catalogue.catalogue_empty") : t("catalogue.empty_title")}</h2>
              {equipment.length > 0 && <p>{t("catalogue.empty_text")}</p>}
              {filtered && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setSearch("");
                    setCategoryId(null);
                  }}
                >
                  {t("app.reset_filters")}
                </button>
              )}
            </div>
          ) : (
            <div className="eq-grid">
              {visible.map((item) => (
                <EquipmentCard
                  key={item.id}
                  equipment={item}
                  selected={cart.has(item.id)}
                  blockingStatuses={settings.blocking_equipment_statuses}
                  onToggle={() => cart.toggle(item)}
                />
              ))}
            </div>
          )}
        </div>

        <CartPanel />
      </div>
    </main>
  );
}
