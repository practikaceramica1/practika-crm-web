import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/admin");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-gradient-to-br from-[#1a1f3d] via-[#1e2a55] to-[#10162e] p-12 text-white lg:block">
        <h1 className="text-4xl font-semibold">Practika CRM v3</h1>
        <p className="mt-3 max-w-md text-sm text-indigo-100">
          Gestión visual por vistas para series, formatos, colores y documentos.
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="card w-full max-w-md p-6">
          <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-500">Acceso administrador</p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
