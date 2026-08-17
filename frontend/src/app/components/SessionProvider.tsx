"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken } from "../lib/api";
import { FALLBACK_SETTINGS, PublicSettings, Role, UserProfile } from "../lib/types";

interface SessionValue {
  user: UserProfile | null;
  /** Réglages publics de la plateforme (durées max, listes de choix). */
  settings: PublicSettings;
  loading: boolean;
  logout: () => void;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<PublicSettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    try {
      const [profile, publicSettings] = await Promise.all([
        api<UserProfile>("/auth/me"),
        // Un backend plus ancien peut ne pas exposer cette route : on garde les valeurs par défaut.
        api<PublicSettings>("/settings/public").catch(() => FALLBACK_SETTINGS),
      ]);
      setUser(profile);
      setSettings({ ...FALLBACK_SETTINGS, ...publicSettings });
    } catch {
      clearToken();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(() => {
    clearToken();
    window.location.assign("/login");
  }, []);

  return (
    <SessionContext.Provider value={{ user, settings, loading, logout, reload }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession doit être utilisé dans un SessionProvider");
  }
  return context;
}

export function hasRole(role: Role | undefined, minimum: "moderator" | "admin"): boolean {
  if (minimum === "admin") return role === "admin";
  return role === "admin" || role === "moderator";
}
