import { createNewsSectionAction } from "./actions";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { NotifyForm } from "@/components/admin/NotifyForm";
import { SubmitButton } from "@/components/admin/SubmitButton";

export function CreateSectionForm() {
  return (
    <NotifyForm action={createNewsSectionAction} notifySuccess={false} className="card mb-6 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Nueva sección</h2>
      <p className="mt-1 text-sm text-slate-600">
        Ejemplos: <strong>Novedades</strong>, <strong>Ofertas</strong>, <strong>Proyectos</strong>. El título es lo
        que verá el público como cabecera.
      </p>
      <label className="mt-4 block text-sm">
        <span className="font-medium text-slate-700">Título</span>
        <input name="title" className="input mt-1" required minLength={2} maxLength={200} placeholder="Novedades" />
      </label>
      <label className="mt-3 block text-sm">
        <span className="font-medium text-slate-700">Descripción (opcional)</span>
        <textarea
          name="description"
          className="input mt-1 min-h-[88px]"
          maxLength={8000}
          placeholder="Texto introductorio para la web (ubicación del proyecto, materiales, etc.)"
        />
      </label>
      <FormPendingSection>
        <SubmitButton className="btn-primary mt-3 text-sm" pendingText="Creando…">
          Crear sección y editar contenido
        </SubmitButton>
      </FormPendingSection>
    </NotifyForm>
  );
}
