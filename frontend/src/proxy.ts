import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes accessibles sans session (les pages légales doivent l'être : RGPD). */
const PUBLIC_ROUTES = [
  "/login",
  "/mentions-legales",
  "/politique-de-confidentialite",
  "/_next",
  "/favicon.ico",
];

/**
 * Contrôle optimiste : redirige vers /login en l'absence de token.
 * L'autorisation réelle reste faite par le backend à chaque requête.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (!request.cookies.get("token")?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
