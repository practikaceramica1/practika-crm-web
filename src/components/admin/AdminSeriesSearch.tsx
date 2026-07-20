"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { AdminSeriesSearchItem } from "@/lib/adminSeriesSearchTypes";

function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[,.\s×x]+/g, " ")
    .trim();
}

function matchesSeries(item: AdminSeriesSearchItem, rawQuery: string): boolean {
  const q = normalizeSearch(rawQuery);
  if (!q) return true;
  const haystack = normalizeSearch(
    [item.name, item.slug.replace(/-/g, " "), ...item.formats].join(" ")
  );
  return haystack.includes(q);
}

export function AdminSeriesSearch({ series }: { series: AdminSeriesSearchItem[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const sorted = [...series].sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (!value.trim()) return sorted.slice(0, 12);
    return sorted.filter((s) => matchesSeries(s, value)).slice(0, 20);
  }, [series, value]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (value.trim() && filtered.length > 0) setHighlightedIndex(0);
    else setHighlightedIndex(-1);
  }, [filtered, value]);

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("li");
    items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function goToSeries(item: AdminSeriesSearchItem) {
    setIsOpen(false);
    setValue("");
    inputRef.current?.blur();
    router.push(`/admin/series/${item.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          goToSeries(filtered[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md min-w-[220px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar serie o formato…"
          className="input w-full py-2 pl-9 pr-16 text-sm"
          aria-label="Buscar serie por nombre o formato"
          autoComplete="off"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {value ? (
            <button
              type="button"
              className="inline-flex rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="pointer-events-none pr-1 text-[10px] font-medium text-slate-400">Ctrl K</span>
          )}
        </span>
      </div>

      {isOpen ? (
        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">
              {value.trim() ? "Sin resultados" : "No hay series"}
            </p>
          ) : (
            <ul ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox">
              {filtered.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === highlightedIndex}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
                      index === highlightedIndex ? "bg-[#eef2ff]" : "hover:bg-slate-50"
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => goToSeries(item)}
                  >
                    <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                    <span className="text-xs text-slate-500">
                      {item.formats.length ? item.formats.join(" · ") : "Sin formato"}
                      <span className="text-slate-400"> · {item.slug}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
