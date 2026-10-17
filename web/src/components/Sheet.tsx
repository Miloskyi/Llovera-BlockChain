"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Hoja inferior en el celular, diálogo centrado en pantallas grandes. */
export function Sheet({
  open,
  onClose,
  children,
  label,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
  dismissable?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissable, onClose]);

  if (!open || !mounted) return null;
  // Portal al body: un ancestro con backdrop-filter (como el encabezado) atraparía el position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => dismissable && onClose()} />
      <div
        ref={panel}
        tabIndex={-1}
        className="sheet-panel panel relative w-full max-w-md overflow-hidden rounded-b-none rounded-t-[28px] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none sm:rounded-[28px]"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line-2 sm:hidden" aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}
