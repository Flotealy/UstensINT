"use client";

import { Globe } from "lucide-react";
import { LOCALES, Locale, useTranslation } from "./I18nProvider";

const LABELS: Record<Locale, { short: string; full: string }> = {
  fr: { short: "FR", full: "Français" },
  en: { short: "EN", full: "English" },
};

export default function LanguageSwitcher({
  tone = "light",
  showIcon = true,
}: {
  tone?: "light" | "dark";
  showIcon?: boolean;
}) {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      className={tone === "dark" ? "lang-switcher lang-switcher--dark" : "lang-switcher"}
      role="group"
      aria-label="Sélection de la langue / Language selection"
    >
      {showIcon && <Globe size={15} className="lang-switcher__icon" />}
      <div className="lang-switcher__track">
        {LOCALES.map((code) => {
          const active = locale === code;
          return (
            <button
              key={code}
              type="button"
              className={`lang-switcher__btn ${active ? "is-active" : ""}`}
              aria-pressed={active}
              title={LABELS[code].full}
              onClick={() => setLocale(code)}
            >
              {LABELS[code].short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
