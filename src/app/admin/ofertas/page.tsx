import { Megaphone } from "lucide-react";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { isSchemaNotReadyError } from "@/lib/supabase/error-handling";
import { getPrincipalOfferWithAssets, signOfferR2UploadAction } from "./actions";
import { OfferAssetsEditor } from "./OfferAssetsEditor";

export default async function AdminOfertasPage() {
  let offer: Awaited<ReturnType<typeof getPrincipalOfferWithAssets>>["offer"] = null;
  let assets: Awaited<ReturnType<typeof getPrincipalOfferWithAssets>>["assets"] = [];
  try {
    const data = await getPrincipalOfferWithAssets();
    offer = data.offer;
    assets = data.assets;
  } catch (e: unknown) {
    if (isSchemaNotReadyError(e as { code?: string; message?: string })) {
      return (
        <SetupRequired
          missing="public.offers / public.offer_assets"
          migration="supabase/migrations/20260507_offers.sql"
        />
      );
    }
    throw e;
  }

  if (!offer) {
    return (
      <main className="p-6">
        <p className="text-slate-600">No se encontró la oferta principal. Ejecuta las migraciones de Supabase.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#1a1f3d]">
          <Megaphone className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ofertas en la web</h1>
          <p className="text-sm text-slate-600">
            Sube imágenes o PDF y arrastra para ordenar. La web muestra los archivos en este mismo orden.
          </p>
        </div>
      </div>
      <OfferAssetsEditor
        initialOffer={offer}
        initialAssets={assets}
        signUploadAction={signOfferR2UploadAction}
      />
    </main>
  );
}
