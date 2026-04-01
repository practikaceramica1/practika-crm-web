"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function FormPendingSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();

  return (
    <div
      aria-busy={pending}
      className={`${className} ${pending ? "pointer-events-none opacity-70" : ""}`.trim()}
    >
      {children}
    </div>
  );
}
