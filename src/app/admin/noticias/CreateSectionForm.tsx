import { createNewsSectionAction } from "./actions";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SubmitButton } from "@/components/admin/SubmitButton";

export function CreateSectionForm() {
  return (
    <form action={createNewsSectionAction} className="card mb-6 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Nueva sección</h2>
      <p className="mt-1 text-sm text-slate-600">
        Ejemplos: <strong>novedades</strong>, <strong>ofertas</strong>, <strong>proyectos</strong>. El slug forma parte de la URL interna; el título es lo que verá el público como cabecera.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Título</span>
          <input name="title" className="input mt-1" required minLength={2} maxLength={200} placeholder="Novedades" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Slug (opcional)</span>
          <input name="slug" className="input mt-1" maxLength={120} placeholder="novedades" />
        </label>
      </div>
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
    </form>
  );
}
