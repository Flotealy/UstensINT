"use client";

import React from "react";
import AppShell from "../components/AppShell";
import CartBar from "../components/CartBar";
import { CartProvider, useCart } from "../components/CartProvider";
import ReservationDialog from "../components/ReservationDialog";
import { SessionProvider } from "../components/SessionProvider";

function Frame({ children }: { children: React.ReactNode }) {
  const { items } = useCart();

  return (
    <div className="shell" data-cartbar={items.length > 0 ? "1" : "0"}>
      <AppShell>{children}</AppShell>
      <CartBar />
      <ReservationDialog />
    </div>
  );
}

/** Gabarit commun à toutes les pages nécessitant une session. */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <Frame>{children}</Frame>
      </CartProvider>
    </SessionProvider>
  );
}
