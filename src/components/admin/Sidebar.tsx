"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Download, FolderKanban, Filter, Newspaper, Ruler } from "lucide-react";
import { FormPendingSection } from "@/components/admin/FormPendingSection";
import { RefreshWebCacheButton } from "@/components/admin/RefreshWebCacheButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { signOutAction } from "@/app/admin/actions";

const links = [
  { href: "/admin/series", label: "Series", hint: "Constructor", icon: FolderKanban },
  { href: "/admin/pendientes", label: "Pendientes", hint: "Checklist", icon: ClipboardList },
  { href: "/admin/noticias", label: "Noticias", hint: "Web", icon: Newspaper },
  { href: "/admin/descargas-catalogos", label: "Catálogos (descargas)", hint: "Web", icon: Download },
  { href: "/admin/formats", label: "Formatos", hint: "Global", icon: Ruler },
  { href: "/admin/filters", label: "Filtros", hint: "Catálogo", icon: Filter },
];

export function Sidebar({
  userEmail,
  pendingCount = 0,
}: {
  userEmail: string;
  pendingCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-auto flex-col overflow-hidden border-r border-slate-200 bg-slate-50/70 p-4 lg:sticky lg:top-0 lg:h-screen">
      <div className="card shrink-0 p-4">
        <p className="text-xs uppercase tracking-widest text-[#1a1f3d]">Practika</p>
        <h1 className="text-xl font-bold text-slate-900">CRM v3</h1>
      </div>
      <nav className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          const showBadge = link.href === "/admin/pendientes" && pendingCount > 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                active
                  ? "border-[#d8dff5] bg-[#eef2ff] text-[#1a1f3d]"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block text-sm font-semibold">{link.label}</span>
                  {showBadge ? (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-slate-500">{link.hint}</span>
              </span>
            </Link>
          );
        })}
        <RefreshWebCacheButton />
      </nav>

      <div className="mt-auto shrink-0 space-y-2 border-t border-slate-200 pt-4">
        <p className="truncate px-1 text-xs text-slate-500" title={userEmail}>
          {userEmail || "Usuario"}
        </p>
        <form action={signOutAction}>
          <FormPendingSection>
            <SubmitButton
              className="btn-secondary w-full justify-center text-xs"
              pendingText="Saliendo..."
            >
              Salir de sesión
            </SubmitButton>
          </FormPendingSection>
        </form>
      </div>
    </aside>
  );
}
