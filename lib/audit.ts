import { createClient } from "@/lib/supabase/server";

export type AuditLogRow = {
  id: string;
  company_id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string | null; email: string | null } | null;
};

type RawAuditLogRow = Omit<AuditLogRow, "actor">;

export async function listAuditLogs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,company_id,actor_id,action,table_name,record_id,ip_address,user_agent,old_values,new_values,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Audit logs query failed", {
      code: error.code,
      message: error.message,
      details: error.details
    });
    throw new Error("No se pudieron cargar los eventos de auditoría.");
  }

  const rows = (data ?? []) as RawAuditLogRow[];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter(Boolean))) as string[];

  if (actorIds.length === 0) {
    return rows.map((row) => ({ ...row, actor: null })) satisfies AuditLogRow[];
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id,full_name,email")
    .in("id", actorIds);

  if (usersError) {
    console.warn("Audit actor lookup failed", {
      code: usersError.code,
      message: usersError.message
    });
  }

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));

  return rows.map((row) => ({
    ...row,
    actor: row.actor_id ? usersById.get(row.actor_id) ?? null : null
  })) satisfies AuditLogRow[];
}
