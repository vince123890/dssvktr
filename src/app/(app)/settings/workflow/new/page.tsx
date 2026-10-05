import { createClient } from "@/lib/supabase/server";
import { canManageSettings } from "@/lib/rbac";
import { requireMenu } from "@/lib/menuAccess";
import { notFound } from "next/navigation";
import { TemplateEditor } from "../../WorkflowCatalog";
import { loadEditorInitial, loadQualifierLists } from "../editorData";

export default async function NewWorkflowPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const me = await requireMenu("settings");
  if (!canManageSettings(me)) notFound();
  const supabase = await createClient();
  const [lists, data] = await Promise.all([loadQualifierLists(supabase), loadEditorInitial(supabase, { from: from ?? null })]);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{from ? `Duplikat workflow ${from}` : "Tambah workflow"}</h1>
        <p className="mt-1 text-sm text-muted">
          Isi kapan workflow ini dipakai (qualifier) dan langkah approval-nya. Setelah disimpan, workflow langsung aktif
          dan ikut dipilih otomatis saat quotation disubmit.
        </p>
      </div>
      <TemplateEditor key={from ?? "new"} templateCode={null} isFallback={false} lists={lists} initial={data.initial} />
    </div>
  );
}
