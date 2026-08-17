"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { useTranslation } from "./components/I18nProvider";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="center-page">
      <div className="card center-page__card">
        <Compass size={44} color="var(--primary)" />
        <h1>{t("errors.not_found_title")}</h1>
        <p className="muted">{t("errors.not_found_text")}</p>
        <Link href="/" className="btn btn--primary">
          {t("errors.home")}
        </Link>
      </div>
    </div>
  );
}
