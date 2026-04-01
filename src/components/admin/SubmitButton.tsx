"use client";

import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type Props = {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  showSpinner?: boolean;
  confirmMessage?: string;
};

export function SubmitButton({
  children,
  pendingText = "Guardando...",
  className = "btn-primary",
  disabled,
  showSpinner = true,
  confirmMessage,
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!confirmMessage || pending || disabled) return;
        const ok = window.confirm(confirmMessage);
        if (!ok) event.preventDefault();
      }}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          {showSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
