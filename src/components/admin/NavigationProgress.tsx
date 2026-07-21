"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 100;

/** Aviso global para navegaciones vía router.push (p. ej. buscador de series). */
export function signalAppNavigationStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("practika-crm:nav-start"));
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShowTimer = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }, []);

  const startPending = useCallback(() => {
    clearShowTimer();
    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
  }, [clearShowTimer]);

  const stopPending = useCallback(() => {
    clearShowTimer();
    setVisible(false);
  }, [clearShowTimer]);

  useEffect(() => {
    stopPending();
  }, [pathname, searchParams, stopPending]);

  useEffect(() => {
    const onNavStart = () => startPending();

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = e.target as Element | null;
      const a = el?.closest?.("a");
      if (!a) return;
      if (a.hasAttribute("download")) return;
      if (a.getAttribute("target") === "_blank") return;

      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      startPending();
    };

    window.addEventListener("practika-crm:nav-start", onNavStart);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("practika-crm:nav-start", onNavStart);
      document.removeEventListener("click", onClick, true);
      clearShowTimer();
    };
  }, [startPending, clearShowTimer]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
      role="progressbar"
      aria-busy={visible}
    >
      <div className="nav-progress-bar h-full w-1/3 bg-[var(--primary)]" />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
