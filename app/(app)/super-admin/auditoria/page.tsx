import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { ShieldCheck } from "lucide-react";
import { listAuditLogs, type AuditLogRow } from "@/lib/audit";
import { getTenantContext } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SuperAdminAuditPage() {
  const tenant = await getTenantContext();

  if (tenant.role !== "SUPER_ADMIN") {
    notFound();
  }

  let rows: AuditLogRow[] = [];
  let error: string | null = null;

  try {
    rows = await listAuditLogs();
  } catch (caughtError) {
    console.error("Audit logs failed to load", {
      message: caughtError instanceof Error ? caughtError.message : "Unknown error"
    });
    error = "No se pudieron cargar los eventos de auditoría.";
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Auditoría global</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Sección exclusiva para SUPER_ADMIN con eventos de seguridad, cambios en los datos y acciones de usuarios.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes</CardTitle>
          <CardDescription>Últimos 200 eventos registrados en la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay eventos de auditoría registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tabla</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Cambios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell>{row.actor?.full_name ?? row.actor?.email ?? "Sistema"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.action}</Badge>
                      </TableCell>
                      <TableCell>{row.table_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.record_id ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.ip_address ?? "-"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {row.new_values ? JSON.stringify(row.new_values) : row.old_values ? JSON.stringify(row.old_values) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
