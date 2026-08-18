import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Cormorant_Garamond, Newsreader, Roboto } from "next/font/google";
import "./globals.css";
import { I18nProvider, LOCALE_COOKIE, Locale } from "./components/I18nProvider";
import CookieBanner from "./components/CookieBanner";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

// Titrage « grande maison » : réservé aux enseignes (page de connexion).
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#012d38",
};

export const metadata: Metadata = {
  title: "UstensINT — Cook'It",
  description: "Réservation de matériel et gestion de stock de cuisine — Club Cook'It",
  applicationName: "UstensINT",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = stored === "en" ? "en" : "fr";

  return (
    <html
      lang={locale}
      className={`${newsreader.variable} ${roboto.variable} ${cormorant.variable}`}
    >
      <body>
        <I18nProvider initialLocale={locale}>
          {children}
          <CookieBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
