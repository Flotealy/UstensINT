"use client";

import Cookies from "js-cookie";

export const TOKEN_COOKIE = "token";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE);
}

export function setToken(token: string): void {
  Cookies.set(TOKEN_COOKIE, token, {
    expires: 7,
    sameSite: "lax",
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  });
}

export function clearToken(): void {
  Cookies.remove(TOKEN_COOKIE);
}

/** FastAPI renvoie `detail` en string, ou en liste d'erreurs pour un 422. */
function extractDetail(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload) return payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : null,
        )
        .filter(Boolean);
      if (messages.length) return messages.join(" · ");
    }
  }
  return fallback;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Corps JSON (sérialisé automatiquement). Utiliser `raw` pour un FormData. */
  json?: unknown;
  raw?: BodyInit;
  /** Ne pas rediriger vers /login si le token est refusé (utile sur la page de connexion). */
  anonymous?: boolean;
}

/**
 * Appel à l'API sous /api. Ajoute le token, normalise les erreurs et
 * déconnecte proprement si la session n'est plus valide.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, raw, anonymous, headers, ...rest } = options;
  const token = getToken();

  const finalHeaders = new Headers(headers);
  if (json !== undefined) finalHeaders.set("Content-Type", "application/json");
  if (token && !anonymous) finalHeaders.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : raw,
    });
  } catch {
    throw new ApiError(0, "network");
  }

  if (response.status === 401 && !anonymous) {
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
    throw new ApiError(401, "unauthorized");
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, extractDetail(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}
