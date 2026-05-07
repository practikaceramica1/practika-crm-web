"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Filter, Megaphone, Ruler } from "lucide-react";

const links = [
  { href: "/admin/series", label: "Series", hint: "Constructor", icon: FolderKanban },
  { href: "/admin/ofertas", label: "Ofertas", hint: "Web", icon: Megaphone },
  { href: "/admin/formats", label: "Formatos", hint: "Global", icon: Ruler },
  { href: "/admin/filters", label: "Filtros", hint: "Catálogo", icon: Filter },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-r border-slate-200 bg-slate-50/70 p-4">
      <div className="card p-4">
        <p className="text-xs uppercase tracking-widest text-[#1a1f3d]">Practika</p>
        <h1 className="text-xl font-bold text-slate-900">CRM v3</h1>
      </div>
      <nav className="mt-4 space-y-1.5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
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
              <Icon className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block text-sm font-semibold">{link.label}</span>
                <span className="block text-xs text-slate-500">{link.hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
