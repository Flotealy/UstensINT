"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "./I18nProvider";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Panneau plus large (formulaires à deux colonnes). */
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Boîte de dialogue basée sur l'élément <dialog> natif : piège de focus,
 * touche Échap et fond inerte gérés par le navigateur.
 * Feuille ancrée en bas sur mobile, fenêtre centrée sur grand écran.
 */
export default function Modal({ open, onClose, title, wide, children, footer }: ModalProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clic en dehors du panneau (sur le fond) : on ferme.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={wide ? "dialog__panel dialog__panel--wide" : "dialog__panel"}>
        <header className="dialog__head">
          <h2 className="dialog__title">{title}</h2>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label={t("app.close")}>
            <X size={20} />
          </button>
        </header>
        {open && children}
        {open && footer ? <footer className="dialog__foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
