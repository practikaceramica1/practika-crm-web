/** Shared types/constants for download catalogs (must live outside `"use server"` actions). */

export type CatalogLang = "en" | "fr" | "de" | "pt";
export const CATALOG_EXTRA_LANGS: CatalogLang[] = ["en", "fr", "de", "pt"];

export type CatalogTranslationEntry = { title: string; subtitle: string };
export type CatalogTranslations = Partial<Record<CatalogLang, CatalogTranslationEntry>>;

export type DownloadCatalogItemRow = {
  id: string;
  title: string;
  subtitle: string | null;
  storage_provider: string;
  file_key: string;
  mime_type: string | null;
  file_size_hint: string | null;
  sort_order: number;
  status: "draft" | "published";
  translations: CatalogTranslations | null;
};

export type SignDownloadCatalogPdfResult =
  | { ok: true; putUrl: string; fileKey: string; contentType: string; itemId: string }
  | { ok: false; message: string };

export type RegisterDownloadCatalogItemResult = { ok: true } | { ok: false; message: string };
