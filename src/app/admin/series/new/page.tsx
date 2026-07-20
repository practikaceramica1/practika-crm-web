import { createSeriesAction } from "../actions";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { NotifyForm } from "@/components/admin/NotifyForm";
import { SubmitButton } from "@/components/admin/SubmitButton";

export default function NewSeriesPage() {
  return (
    <main className="space-y-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Nueva serie</h1>
        <p className="mt-1 text-sm text-slate-500">Solo nombre. El resto se construye por vistas en el detalle.</p>
      </section>
      <NotifyForm action={createSeriesAction} notifySuccess={false} className="card p-5">
        <FormPendingSection>
          <label className="label">Nombre</label>
          <input name="name" className="input" placeholder="Kamen" required />
          <SubmitButton className="btn-primary mt-4" pendingText="Creando serie...">
            Crear serie
          </SubmitButton>
        </FormPendingSection>
      </NotifyForm>
    </main>
  );
}
