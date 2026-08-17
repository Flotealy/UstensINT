"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { useTranslation } from "./components/I18nProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("UstensINT — erreur applicative :", error);
  }, [error]);

  return (
    <div className="center-page">
      <div className="card center-page__card">
        <AlertOctagon size={44} color="var(--danger)" />
        <h1>{t("errors.error_title")}</h1>
        <p className="muted">{t("errors.error_text")}</p>
        <div className="inline">
          <button type="button" className="btn btn--ghost" onClick={reset}>
            {t("app.retry")}
          </button>
          <Link href="/" className="btn btn--primary">
            {t("errors.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
