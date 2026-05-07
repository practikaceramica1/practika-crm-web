import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { getNewsSectionWithAssets, updateNewsSectionMetaAction } from "../actions";
import { NoticiaSectionAssetsEditor } from "../NoticiaSectionAssetsEditor";

type Props = { params: Promise<{ id: string }> };

export default async function AdminNoticiaSectionPage({ params }: Props) {
  const { id } = await params;
  let section: Awaited<ReturnType<typeof getNewsSectionWithAssets>>["section"] = null;
  let assets: Awaited<ReturnType<typeof getNewsSectionWithAssets>>["assets"] = [];
  try {
    const data = await getNewsSectionWithAssets(id);
    section = data.section;
    assets = data.assets;
  } catch (e: unknown) {
    if (isSchemaNotReadyError(e as { code?: string; message?: string })) {
      return (
        <SetupRequired
          missing="public.news_sections"
          migration="supabase/migrations/20260508_news_sections.sql"
        />
      );
    }
    throw e;
  }
  if (!section) notFound();

  return (
    <main className="p-6">
      <nav className="mb-4 text-sm text-slate-600">
        <Link href="/admin/noticias" className="text-indigo-600 hover:underline">
          ← Noticias
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">Editar sección</h1>
      <p className="text-sm text-slate-600">Título, descripción y estado de publicación.</p>

      <form action={updateNewsSectionMetaAction} className="card mt-4 p-5">
        <input type="hidden" name="sectionId" value={section.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Título</span>
            <input name="title" className="input mt-1" required defaultValue={section.title} maxLength={200} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Slug</span>
            <input name="slug" className="input mt-1" required defaultValue={section.slug} maxLength={120} />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="font-medium text-slate-700">Descripción (opcional)</span>
          <textarea
            name="description"
            className="input mt-1 min-h-[100px]"
            maxLength={8000}
            defaultValue={section.description || ""}
            placeholder="Texto visible bajo el título en la web"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="font-medium text-slate-700">Estado</span>
          <select name="status" className="input mt-1 max-w-xs" defaultValue={section.status}>
            <option value="draft">Borrador</option>
            <option value="published">Publicada</option>
          </select>
        </label>
        <FormPendingSection>
          <SubmitButton className="btn-primary mt-3 text-sm" pendingText="Guardando…">
            Guardar datos de la sección
          </SubmitButton>
        </FormPendingSection>
      </form>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Archivos de la sección</h2>
        <NoticiaSectionAssetsEditor sectionId={section.id} initialAssets={assets} />
      </div>
    </main>
  );
}
