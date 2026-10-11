import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Private file storage for signed quotations, PO and transfer proofs
 * (PRD FR-2.11, FR-9.1, FR-9.3). One private bucket; files are only ever
 * served through short-lived signed URLs.
 */

export const FILE_BUCKET = "quotation-files";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"] as const;
export const SIGNED_URL_SECONDS = 60 * 10;

export type FileKind = "signed" | "po" | "payment";

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

/** Returns an error message, or null when the file is acceptable. */
export function validateUpload(file: UploadCandidate | null | undefined): string | null {
  if (!file || file.size === 0) return "Pilih berkas (PDF, PNG, atau JPG).";
  if (file.size > MAX_FILE_BYTES) return "Ukuran berkas maksimal 10 MB.";
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return "Format berkas harus PDF, PNG, atau JPG.";
  return null;
}

/** Keeps the extension, strips everything that is not [a-z0-9._-]. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5) : "";
  return `${base || "berkas"}${ext ? `.${ext}` : ""}`;
}

/** e.g. signed/<proposalId>/1700000000000-ttd.pdf — the timestamp keeps re-uploads from colliding. */
export function buildStoragePath(kind: FileKind, ownerId: string, fileName: string, at: number = Date.now()): string {
  return `${kind}/${ownerId}/${at}-${safeFileName(fileName)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

export async function uploadFile(supabase: Db, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Gagal mengunggah berkas: ${error.message}`);
}

/** Best-effort cleanup when the database step after an upload fails. */
export async function removeFile(supabase: Db, path: string): Promise<void> {
  await supabase.storage.from(FILE_BUCKET).remove([path]);
}

export async function signedUrl(supabase: Db, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}
