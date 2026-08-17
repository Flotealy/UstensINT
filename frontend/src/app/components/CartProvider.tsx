"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Equipment } from "../lib/types";

const STORAGE_KEY = "ustensint.selection";

interface CartValue {
  items: Equipment[];
  has: (id: string) => boolean;
  toggle: (equipment: Equipment) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Retire les objets qui ne sont plus dans le catalogue. */
  sync: (available: Equipment[]) => void;
  total: number;
  /** Étape finale (dates, caution) : ouverte depuis la colonne ou la barre. */
  checkoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [restored, setRestored] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // La sélection survit à un rechargement de page.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setItems(parsed as Equipment[]);
      }
    } catch {
      // stockage indisponible (navigation privée) : on continue en mémoire
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignoré
    }
  }, [items, restored]);

  const toggle = useCallback((equipment: Equipment) => {
    setItems((current) =>
      current.some((item) => item.id === equipment.id)
        ? current.filter((item) => item.id !== equipment.id)
        : [...current, equipment],
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const sync = useCallback((available: Equipment[]) => {
    const byId = new Map(available.map((item) => [item.id, item]));
    setItems((current) => {
      const next = current.filter((item) => byId.has(item.id)).map((item) => byId.get(item.id)!);
      const unchanged =
        next.length === current.length && next.every((item, index) => item === current[index]);
      return unchanged ? current : next;
    });
  }, []);

  const value = useMemo<CartValue>(
    () => ({
      items,
      has: (id: string) => items.some((item) => item.id === id),
      toggle,
      remove,
      clear,
      sync,
      total: items.reduce((sum, item) => sum + Number(item.deposit_amount ?? 0), 0),
      checkoutOpen,
      openCheckout: () => setCheckoutOpen(true),
      closeCheckout: () => setCheckoutOpen(false),
    }),
    [items, toggle, remove, clear, sync, checkoutOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart doit être utilisé dans un CartProvider");
  }
  return context;
}
