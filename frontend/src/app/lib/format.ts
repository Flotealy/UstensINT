/** Formatage partagé : montants, dates, initiales. */

export function formatMoney(amount: number | null | undefined, locale: string): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Les dates de l'API sont des jours calendaires (YYYY-MM-DD) : pas de fuseau. */
export function formatDate(iso: string, locale: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Nombre de jours entre deux dates ISO, bornes incluses. */
export function dayCount(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${endIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Minuscules sans accents, pour comparer une recherche à un libellé. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
