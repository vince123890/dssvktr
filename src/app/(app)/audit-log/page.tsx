import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { AuditLogEntry, Profile } from "@/types/database";
import { ScrollText } from "lucide-react";

const ACTION_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  CREATE: "info",
  UPDATE: "default",
  SUBMIT: "info",
  APPROVE: "success",
  APPROVE_WITH_CONDITIONS: "warning",
  REJECT: "danger",
  TARGETED_REJECT: "danger",
  ESCALATE: "warning",
  RECALCULATE: "default",
  ADD_COST_ITEM: "info",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; entity?: string }>;
}) {
  const { actor, entity } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log_entry")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (entity) query = query.eq("entity_type", entity);
  if (actor) query = query.eq("actor_id", actor);

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profile").select("*"),
  ]);

  const entries = (logs ?? []) as AuditLogEntry[];
  const profileById = Object.fromEntries(
    ((profiles ?? []) as Profile[]).map((p) => [p.id, p])
  );

  const entityTypes = Array.from(new Set(entries.map((e) => e.entity_type)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ScrollText size={20} /> Immutable Audit Trail
        </h1>
        <p className="text-sm text-muted mt-1">
          Riwayat perubahan (who, what, when, why) — FR-3.3. Log bersifat
          append-only; RLS pada tabel ini hanya mengizinkan INSERT (lihat
          supabase/migrations/0002_rls_policies.sql).
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <select name="entity" defaultValue={entity ?? ""} className="rounded-lg border border-card-border px-3 py-1.5 text-xs bg-white">
          <option value="">Semua Entity Type</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
          Filter
        </button>
      </form>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Waktu</th>
              <th className="px-5 py-3 font-medium">Aktor</th>
              <th className="px-5 py-3 font-medium">Aksi</th>
              <th className="px-5 py-3 font-medium">Entity</th>
              <th className="px-5 py-3 font-medium">Perubahan</th>
              <th className="px-5 py-3 font-medium">Alasan</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-card-border last:border-0 align-top">
                <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                  {formatDate(e.created_at)}
                </td>
                <td className="px-5 py-3 text-xs">
                  {e.actor_id ? profileById[e.actor_id]?.full_name ?? "—" : "System"}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={ACTION_TONE[e.action] ?? "default"}>{e.action}</Badge>
                </td>
                <td className="px-5 py-3 text-xs text-muted font-mono">
                  {e.entity_type}
                  <div className="text-[10px] opacity-70">{e.entity_id.slice(0, 8)}...</div>
                </td>
                <td className="px-5 py-3 text-xs">
                  {e.field_changes.length > 0 ? (
                    <ul className="space-y-0.5">
                      {e.field_changes.slice(0, 3).map((fc, i) => (
                        <li key={i} className="text-[11px]">
                          <span className="font-medium">{fc.field}</span>:{" "}
                          <span className="text-muted">{String(fc.old ?? "∅")}</span> →{" "}
                          <span>{String(fc.new ?? "∅")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-muted italic">{e.reason ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                  Belum ada log audit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
