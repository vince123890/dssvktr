import { createClient } from "@/lib/supabase/server";
import { canManageSettings } from "@/lib/rbac";
import { requireMenu } from "@/lib/menuAccess";
import { notFound } from "next/navigation";
import { TemplateEditor } from "../../../WorkflowCatalog";
import { loadEditorInitial, loadQualifierLists } from "../../editorData";

export default async function EditWorkflowPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const me = await requireMenu("settings");
  if (!canManageSettings(me)) notFound();
  const supabase = await createClient();
  const [lists, data] = await Promise.all([loadQualifierLists(supabase), loadEditorInitial(supabase, { edit: code })]);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Ubah workflow</h1>
      <TemplateEditor templateCode={code} isFallback={data.isFallback} lists={lists} initial={data.initial} />
    </div>
  );
}
