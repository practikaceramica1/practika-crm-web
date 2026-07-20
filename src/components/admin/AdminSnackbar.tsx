"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Snackbar, type SnackbarState } from "@/components/admin/Snackbar";

type NotifyInput = NonNullable<SnackbarState>;

type AdminSnackbarContextValue = {
  notify: (value: NotifyInput) => void;
};

const AdminSnackbarContext = createContext<AdminSnackbarContextValue | null>(null);

/** Sobrevive a remounts tras revalidatePath / refresh RSC. */
let pendingToast: NotifyInput | null = null;
const toastListeners = new Set<(value: NotifyInput) => void>();

function emitToast(value: NotifyInput) {
  pendingToast = value;
  toastListeners.forEach((listener) => listener(value));
}

export function AdminSnackbarProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SnackbarState>(null);

  useEffect(() => {
    const listener = (next: NotifyInput) => setValue(next);
    toastListeners.add(listener);
    if (pendingToast) {
      setValue(pendingToast);
    }
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const notify = useCallback((next: NotifyInput) => {
    emitToast(next);
  }, []);

  const onClose = useCallback(() => {
    pendingToast = null;
    setValue(null);
  }, []);

  const ctx = useMemo(() => ({ notify }), [notify]);

  return (
    <AdminSnackbarContext.Provider value={ctx}>
      {children}
      <Snackbar value={value} onClose={onClose} />
    </AdminSnackbarContext.Provider>
  );
}

export function useAdminSnackbar() {
  const ctx = useContext(AdminSnackbarContext);
  if (!ctx) {
    throw new Error("useAdminSnackbar debe usarse dentro de AdminSnackbarProvider");
  }
  return ctx;
}

/** Seguro fuera del provider (no lanza): útil en componentes opcionales. */
export function useOptionalAdminSnackbar() {
  return useContext(AdminSnackbarContext);
}
