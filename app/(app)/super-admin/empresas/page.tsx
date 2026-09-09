import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { Building2 } from "lucide-react";
import { listCompaniesOverview } from "@/lib/actions/super-admin";
import { getTenantContext } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyStatusToggle } from "@/components/company-status-toggle";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  ARCHIVED: "Archivada"
};

export default async function SuperAdminCompaniesPage() {
  const tenant = await getTenantContext();

  if (tenant.role !== "SUPER_ADMIN") {
    notFound();
  }

  let rows: Awaited<ReturnType<typeof listCompaniesOverview>> = [];
  let error: string | null = null;

  try {
    rows = await listCompaniesOverview();
  } catch (caughtError) {
    console.error("Company overview failed to load", {
      message: caughtError instanceof Error ? caughtError.message : "Unknown error"
    });
    error = "No se pudo cargar el listado de empresas.";
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Empresas registradas</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Sección exclusiva para SUPER_ADMIN. Listado mínimo para operar los primeros clientes: quién se
          registró, con qué nicho, cuándo, y una forma de suspender o reactivar el acceso sin tocar la base
          de datos directamente.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Todas las empresas</CardTitle>
          <CardDescription>{rows.length} empresa(s) registrada(s).</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no hay empresas registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Nicho</TableHead>
                    <TableHead>Administrador</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Registrada</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.businessType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.adminName ?? "—"}
                        {row.adminEmail ? (
                          <div className="text-xs text-muted-foreground">{row.adminEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.userCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "ACTIVE" ? "default" : "destructive"}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CompanyStatusToggle companyId={row.id} status={row.status} />
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
