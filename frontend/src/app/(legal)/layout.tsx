import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Gabarit des pages légales : lisible seul, sans session ni navigation
 * applicative. Le contenu reste en français (documents de droit français).
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <div className="shell__main">
        <header className="topbar" style={{ position: "static" }}>
          <Link href="/" className="topbar__btn" aria-label="Retour à l'accueil">
            <ArrowLeft size={22} />
          </Link>
          <span className="topbar__title">UstensINT</span>
        </header>

        <div className="doc">{children}</div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} UstensINT — Télécom SudParis</span>
          <span className="footer__links">
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/politique-de-confidentialite">Politique de confidentialité</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
