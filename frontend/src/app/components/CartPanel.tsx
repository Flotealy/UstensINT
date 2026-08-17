"use client";

import { ShoppingBasket, X } from "lucide-react";
import { useCart } from "./CartProvider";
import { useTranslation } from "./I18nProvider";
import { formatMoney } from "../lib/format";

/** Colonne « Ma sélection », visible à partir de 1200px (voir .cart-col). */
export default function CartPanel() {
  const { t, tn, locale } = useTranslation();
  const { items, total, remove, clear, openCheckout } = useCart();

  return (
    <aside className="card cart-col">
      <div className="card__head">
        <h2 style={{ fontSize: "1.1rem" }}>{t("cart.title")}</h2>
        {items.length > 0 && (
          <button type="button" className="btn btn--sm btn--icon" onClick={clear} title={t("cart.clear")}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className="card__body stack">
        {items.length === 0 ? (
          <p className="muted" style={{ display: "flex", gap: 10 }}>
            <ShoppingBasket size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            {t("cart.empty")}
          </p>
        ) : (
          <>
            <ul className="cart-list" style={{ listStyle: "none" }}>
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  <span className="cart-item__text">
                    <span className="cart-item__name">{item.name}</span>
                    <span className="cart-item__meta">
                      #{item.label} ·{" "}
                      {item.deposit_amount
                        ? formatMoney(item.deposit_amount, locale)
                        : t("catalogue.no_deposit")}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--icon is-danger"
                    onClick={() => remove(item.id)}
                    aria-label={t("cart.remove", { name: item.name })}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="cart-total">
              <span>{t("cart.total")}</span>
              <span className="cart-total__value">{formatMoney(total, locale)}</span>
            </div>

            <button type="button" className="btn btn--primary btn--block" onClick={openCheckout}>
              {t("cart.continue")} · {tn("cart.count", items.length)}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
