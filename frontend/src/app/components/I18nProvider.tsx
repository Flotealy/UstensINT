"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import fr from "../locales/fr.json";
import en from "../locales/en.json";

export type Locale = "fr" | "en";

export const LOCALES: Locale[] = ["fr", "en"];
export const LOCALE_COOKIE = "NEXT_LOCALE";

const dictionaries: Record<Locale, unknown> = { fr, en };

type Params = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Traduit une clé pointée, ex. t("cart.remove", { name }). */
  t: (key: string, params?: Params) => string;
  /** Variante au pluriel : la clé doit contenir les sous-clés `one` et `other`. */
  tn: (key: string, count: number, params?: Params) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(dictionary: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(String(value)),
    template,
  );
}

export function I18nProvider({
  children,
  initialLocale = "fr",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Aucun choix enregistré : on suit la langue du navigateur, une seule fois.
  useEffect(() => {
    if (Cookies.get(LOCALE_COOKIE)) return;
    const browser = navigator.language.slice(0, 2).toLowerCase();
    const detected: Locale = browser === "fr" ? "fr" : "en";
    if (detected !== initialLocale) setLocaleState(detected);
    Cookies.set(LOCALE_COOKIE, detected, { expires: 365, sameSite: "lax" });
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    Cookies.set(LOCALE_COOKIE, next, { expires: 365, sameSite: "lax" });
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, params?: Params) => {
      const entry = lookup(dictionaries[locale], key);
      if (typeof entry !== "string") {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] clé manquante ou non textuelle : ${key} (${locale})`);
        }
        return key;
      }
      return interpolate(entry, params);
    };

    const tn = (key: string, count: number, params?: Params) => {
      const rule = new Intl.PluralRules(locale).select(count);
      const branch = lookup(dictionaries[locale], `${key}.${rule}`);
      const fallback = lookup(dictionaries[locale], `${key}.other`);
      const template = typeof branch === "string" ? branch : fallback;
      if (typeof template !== "string") return key;
      return interpolate(template, { count, ...params });
    };

    return { locale, setLocale, t, tn };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation doit être utilisé dans un I18nProvider");
  }
  return context;
}
