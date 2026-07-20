import { Newspaper } from "lucide-react";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { listNewsSectionsAdmin } from "./actions";
import { CreateSectionForm } from "./CreateSectionForm";
import NewsSectionsReorderClient from "./NewsSectionsReorderClient";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminNoticiasPage({ searchParams }: Props) {
  const sp = await searchParams;
  const errorRaw = sp.error;
  const errorMessage =
    typeof errorRaw === "string" ? errorRaw : Array.isArray(errorRaw) ? errorRaw[0] : null;

  let sections: Awaited<ReturnType<typeof listNewsSectionsAdmin>> = [];
  try {
    sections = await listNewsSectionsAdmin();
  } catch (e: unknown) {
    if (isSchemaNotReadyError(e as { code?: string; message?: string })) {
      return (
        <SetupRequired
          missing="public.news_sections / public.news_section_assets"
          migration="supabase/migrations/20260508_news_sections.sql"
        />
      );
    }
    throw e;
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#1a1f3d]">
          <Newspaper className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Noticias (web)</h1>
          <p className="text-sm text-slate-600">
            Crea secciones (Novedades, Ofertas, Proyectos…), añade descripción, archivos destacados y ordena todo desde
            aquí.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <CreateSectionForm />
      {sections.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          Aún no hay secciones. Crea la primera arriba.
        </p>
      ) : (
        <NewsSectionsReorderClient initialSections={sections} />
      )}
    </main>
  );
}
