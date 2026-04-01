import { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { Sidebar } from "@/components/admin/Sidebar";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { signOutAction } from "./actions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminUser();

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Área de administración</p>
              <h2 className="text-lg font-semibold text-slate-900">Constructor de catálogo</h2>
            </div>
            <form action={signOutAction}>
              <FormPendingSection>
                <SubmitButton className="btn-secondary" pendingText="Saliendo...">
                  {user.email} · Salir
                </SubmitButton>
              </FormPendingSection>
            </form>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
