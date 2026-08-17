"use client";

import { ShoppingBasket } from "lucide-react";
import { useCart } from "./CartProvider";
import { useTranslation } from "./I18nProvider";
import { formatMoney } from "../lib/format";

/** Barre flottante de sélection, sous 1200px (voir .cart-bar). */
export default function CartBar() {
  const { t, tn, locale } = useTranslation();
  const { items, total, openCheckout } = useCart();

  if (items.length === 0) return null;

  return (
    <div className="cart-bar">
      <ShoppingBasket size={22} color="var(--primary)" />
      <span className="cart-bar__text">
        <span className="cart-bar__count">{tn("cart.count", items.length)}</span>
        <br />
        <span className="cart-bar__total">
          {t("cart.total")} : {formatMoney(total, locale)}
        </span>
      </span>
      <button type="button" className="btn btn--primary" onClick={openCheckout}>
        {t("cart.continue")}
      </button>
    </div>
  );
}
