"use client";

import { type ComponentProps, type ReactNode } from "react";
import { useAdminSnackbar } from "@/components/admin/AdminSnackbar";
import { errorToUserMessage } from "@/lib/errorMessage";

type ServerAction = (formData: FormData) => void | Promise<unknown>;

type Props = Omit<ComponentProps<"form">, "action"> & {
  action: ServerAction;
  /** Mensaje verde tras éxito (si la action no hace redirect). */
  successMessage?: string;
  /** Si false, no muestra toast de éxito (p. ej. solo errores). Default true. */
  notifySuccess?: boolean;
  children: ReactNode;
};

function isNextRedirect(e: unknown) {
  const digest =
    e && typeof e === "object" && "digest" in e ? String((e as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_REDIRECT");
}

/**
 * Formulario con server action que muestra toast global de éxito/error abajo a la derecha.
 */
export function NotifyForm({
  action,
  successMessage = "Guardado correctamente.",
  notifySuccess = true,
  children,
  ...rest
}: Props) {
  const { notify } = useAdminSnackbar();

  return (
    <form
      {...rest}
      action={async (formData) => {
        try {
          await action(formData);
          if (notifySuccess) {
            notify({ type: "success", message: successMessage });
          }
        } catch (e) {
          if (isNextRedirect(e)) throw e;
          notify({
            type: "error",
            message: errorToUserMessage(e) || "No se pudo completar la acción.",
          });
        }
      }}
    >
      {children}
    </form>
  );
}
