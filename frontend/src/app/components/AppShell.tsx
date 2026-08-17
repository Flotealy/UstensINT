"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  ClipboardList,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  PackageOpen,
  Settings,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "./I18nProvider";
import { hasRole, useSession } from "./SessionProvider";
import LanguageSwitcher from "./LanguageSwitcher";
import { initials } from "../lib/format";
import { Role } from "../lib/types";

type Icon = typeof LayoutGrid;

interface NavItem {
  href: string;
  labelKey: string;
  icon: Icon;
}

interface NavGroup {
  titleKey: string;
  /** Rôle minimum requis pour voir le groupe. */
  access?: "moderator" | "admin";
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    titleKey: "nav.group_book",
    items: [
      { href: "/", labelKey: "nav.catalogue", icon: LayoutGrid },
      { href: "/mes-reservations", labelKey: "nav.my_reservations", icon: CalendarDays },
    ],
  },
  {
    titleKey: "nav.group_manage",
    access: "moderator",
    items: [
      { href: "/moderator/loans", labelKey: "nav.loans", icon: ClipboardList },
      { href: "/moderator/equipment", labelKey: "nav.equipment", icon: Boxes },
      { href: "/moderator/categories", labelKey: "nav.categories", icon: Tags },
      { href: "/moderator/stock", labelKey: "nav.stock", icon: PackageOpen },
    ],
  },
  {
    titleKey: "nav.group_admin",
    access: "admin",
    items: [
      { href: "/admin/users", labelKey: "nav.users", icon: Users },
      { href: "/admin/settings", labelKey: "nav.settings", icon: Settings },
      { href: "/admin/logs", labelKey: "nav.audit_logs", icon: History },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function visibleGroups(role: Role | undefined): NavGroup[] {
  return GROUPS.filter((group) => !group.access || hasRole(role, group.access));
}

function Nav({ variant, onNavigate }: { variant: "rail" | "drawer"; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user, logout } = useSession();
  const pathname = usePathname();

  return (
    <nav className={variant === "rail" ? "nav nav--rail" : "nav"} aria-label={t("app.title")}>
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <Link href="/" className="nav__brand" onClick={onNavigate}>
          <span className="nav__brand-mark">
            <img
              src="/logo.png"
              alt="Cook'It"
              width={28}
              height={28}
              style={{ objectFit: "contain", borderRadius: 6 }}
            />
          </span>
          <span>
            <span className="nav__brand-name">{t("app.title")}</span>
            <span className="nav__brand-sub">Cook'It</span>
          </span>
        </Link>
        {variant === "drawer" && (
          <button
            type="button"
            className="topbar__btn"
            onClick={onNavigate}
            aria-label={t("nav.close_menu")}
          >
            <X size={22} />
          </button>
        )}
      </div>

      <div className="nav__groups">
        {visibleGroups(user?.role).map((group) => (
          <div key={group.titleKey}>
            <p className="nav__group-title">{t(group.titleKey)}</p>
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav__link"
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <ItemIcon size={19} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="nav__foot">
        <Link
          href="/mon-compte"
          className="nav__user"
          onClick={onNavigate}
          aria-current={pathname === "/mon-compte" ? "page" : undefined}
        >
          <span className="nav__avatar">{initials(user?.display_name ?? "")}</span>
          <span className="truncate" style={{ flex: 1 }}>
            <span className="nav__user-name">{user?.display_name}</span>
            <span className="nav__user-role">{t(`roles.${user?.role ?? "user"}`)}</span>
          </span>
        </Link>
        <button type="button" className="nav__logout" onClick={logout}>
          <LogOut size={18} />
          {t("app.logout")}
        </button>
        <div style={{ padding: "6px 8px 2px" }}>
          <LanguageSwitcher tone="dark" />
        </div>
      </div>
    </nav>
  );
}

/**
 * Gabarit des pages authentifiées : rail de navigation sur grand écran,
 * barre supérieure + tiroir sur mobile.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  // Garde-fou côté interface : le backend refuse déjà ces routes.
  useEffect(() => {
    if (!user) return;
    const needsModerator = pathname.startsWith("/moderator");
    const needsAdmin = pathname.startsWith("/admin");
    if (needsAdmin && !hasRole(user.role, "admin")) router.replace("/");
    else if (needsModerator && !hasRole(user.role, "moderator")) router.replace("/");
  }, [pathname, user, router]);

  if (loading || !user) {
    return (
      <div className="center-page">
        <div className="loading-block">
          <span className="spinner" aria-hidden />
          {t("app.loading")}
        </div>
      </div>
    );
  }

  const current = visibleGroups(user.role)
    .flatMap((group) => group.items)
    .find((item) => isActive(pathname, item.href));

  return (
    <>
      <Nav variant="rail" />

      {drawerOpen && (
        <>
          <div className="scrim" onClick={() => setDrawerOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label={t("app.title")}>
            <Nav variant="drawer" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__btn"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("nav.open_menu")}
          >
            <Menu size={22} />
          </button>
          <span className="topbar__title">
            {current ? t(current.labelKey) : t("app.title")}
          </span>
          <Link
            href="/mon-compte"
            className="nav__avatar"
            style={{ width: 34, height: 34, fontSize: 13 }}
            aria-label={t("nav.account")}
          >
            {initials(user?.display_name ?? "")}
          </Link>
        </header>

        {children}

        <footer className="footer">
          <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
          <span className="footer__links">
            <Link href="/mentions-legales">{t("footer.legal")}</Link>
            <Link href="/politique-de-confidentialite">{t("footer.privacy")}</Link>
          </span>
        </footer>
      </div>
    </>
  );
}
