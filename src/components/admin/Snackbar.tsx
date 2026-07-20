"use client";

import { useEffect } from "react";

export type SnackbarState = {
  type: "success" | "error";
  message: string;
} | null;

export function Snackbar({ value, onClose }: { value: SnackbarState; onClose: () => void }) {
  useEffect(() => {
    if (!value) return;
    const t = setTimeout(() => onClose(), 3200);
    return () => clearTimeout(t);
  }, [value, onClose]);

  if (!value) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-6 right-6 z-[9999] max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition-all ${
        value.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {value.message}
    </div>
  );
}
