"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function FormPendingSection({
  children,
  className = "",
  busy: busyProp,
}: {
  children: ReactNode;
  className?: string;
  /** When the form is submitted programmatically (no useFormStatus), set this so the section shows loading. */
  busy?: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = pending || Boolean(busyProp);

  return (
    <div
      aria-busy={busy}
      className={`${className} ${busy ? "pointer-events-none opacity-70" : ""}`.trim()}
    >
      {children}
    </div>
  );
}
