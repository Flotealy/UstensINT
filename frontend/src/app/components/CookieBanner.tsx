"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import { Info } from "lucide-react";
import { useTranslation } from "./I18nProvider";

const CONSENT_COOKIE = "cookie_consent";

/**
 * Bandeau d'information : le site ne dépose que des cookies strictement
 * nécessaires, donc aucun consentement préalable n'est requis (CNIL).
 */
export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!Cookies.get(CONSENT_COOKIE)) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    Cookies.set(CONSENT_COOKIE, "seen", { expires: 365, sameSite: "lax" });
    setVisible(false);
  };

  return (
    <div className="cookie-banner" role="region" aria-label={t("cookies.title")}>
      <Info size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
      <p className="cookie-banner__text">
        <strong>{t("cookies.title")}</strong>
        <br />
        {t("cookies.text")}{" "}
        <Link href="/politique-de-confidentialite">{t("cookies.learn_more")}</Link>
      </p>
      <button type="button" className="btn btn--primary btn--sm" onClick={dismiss}>
        {t("cookies.accept")}
      </button>
    </div>
  );
}
