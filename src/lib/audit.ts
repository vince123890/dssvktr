import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction } from "@/types/database";

interface WriteAuditParams {
  entityType: string;
  entityId: string;
  proposalId?: string | null;
  actorId: string;
  action: AuditAction;
  fieldChanges?: { field: string; old: unknown; new: unknown }[];
  reason?: string;
}

/**
 * Append-only audit write (Technical Logic §6). RLS on audit_log_entry
 * grants INSERT only — no UPDATE/DELETE policy exists, so this is the
 * single, one-way door for recording history.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAuditLog(supabase: SupabaseClient<any>, params: WriteAuditParams) {
  const { error } = await supabase.from("audit_log_entry").insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    proposal_id: params.proposalId ?? null,
    actor_id: params.actorId,
    action: params.action,
    field_changes: params.fieldChanges ?? [],
    reason: params.reason ?? null,
  });

  if (error) {
    console.error("Failed to write audit log entry", error);
  }
}
