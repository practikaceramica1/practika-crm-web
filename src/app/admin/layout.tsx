import { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminSeriesSearch } from "@/components/admin/AdminSeriesSearch";
import { getAdminSeriesSearchIndex } from "@/lib/adminSeriesSearch";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminUser();
  const seriesSearch = await getAdminSeriesSearchIndex();

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Sidebar userEmail={user.email || ""} />
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white/95 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">Área de administración</p>
              <h2 className="text-lg font-semibold text-slate-900">Constructor de catálogo</h2>
            </div>
            <AdminSeriesSearch series={seriesSearch} />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
