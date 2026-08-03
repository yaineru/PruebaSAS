import Link from "next/link";
import type { ModuleConfig, ModuleField } from "@/lib/modules";
import { applyCompanySettings, getCompanySettings } from "@/lib/company-settings";
import { getEnumLabel } from "@/lib/enums";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { listTenantRows, getTenantContext, type ModuleKey } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentActions } from "@/components/document-actions";
import { TenantRecordForm } from "@/components/tenant-record-form";
import { TenantRecordDeleteButton } from "@/components/tenant-record-delete-button";
import { TenantRecordEditButton } from "@/components/tenant-record-edit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type TenantRow = Record<string, string | number | null>;

export async function ModulePage({
  module,
  error,
  q,
  status
}: {
  module: ModuleConfig;
  error?: string;
  q?: string;
  status?: string;
}) {
  const tenant = await getTenantContext();
  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  const visibleModule = await withRelationOptions(applyCompanySettings(module, settings), tenant.companyId);
  let rows: TenantRow[] = [];
  let listError: string | null = null;

  // The first field is always the record's primary label (name/title/etc) -
  // used as the free-text search column. The filterable field is whichever
  // status-like enum/options field the module declares ("status" for most
  // modules, "role" for users - there is at most one per module).
  const searchField = visibleModule.fields[0]?.name;
  const filterField =
    visibleModule.fields.find((field) => field.name === "status" && (field.enumKey || field.options)) ??
    visibleModule.fields.find((field) => field.name === "role" && field.enumKey);
  const searchValue = (q ?? "").trim();
  const statusValue = (status ?? "").trim();

  // The table only has room for a handful of columns, so it shows the first
  // 4 declared fields - but for most modules that means "status" (declared
  // last, so operators can fill it in last) never appears in the list, even
  // though it's the single most-scanned column for a fleet/ops manager. Add
  // it back in whenever it exists and didn't already make the cut.
  const baseColumns = visibleModule.fields.slice(0, 4);
  const visibleColumns =
    filterField && !baseColumns.some((field) => field.name === filterField.name)
      ? [...baseColumns, filterField]
      : baseColumns;

  const deletableTables = new Set(["assets", "maintenance_records", "incidents", "projects"]);
  const canDelete =
    deletableTables.has(visibleModule.table) &&
    (tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN" || tenant.role === "SUPERVISOR");

  // Mirrors lib/security.ts assertCanCreate() - editing a record requires the
  // same permission tier as creating one ("users" is ADMIN/SUPER_ADMIN-only,
  // handled by the first branch below).
  const editOperationTables = new Set(["assets", "projects", "asset_documents"]);
  const editRegisterTables = new Set(["maintenance_records", "incidents"]);
  const canEdit =
    tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN"
      ? true
      : tenant.role === "SUPERVISOR"
        ? editOperationTables.has(visibleModule.table) || editRegisterTables.has(visibleModule.table)
        : tenant.role === "OPERARIO"
          ? editRegisterTables.has(visibleModule.table)
          : false;

  try {
    rows = (await listTenantRows(visibleModule.table as ModuleKey, tenant.companyId, {
      search: searchValue || undefined,
      searchField,
      filterField: filterField?.name,
      filterValue: statusValue || undefined
    })) as TenantRow[];
  } catch (caughtError) {
    console.error("Module rows failed to load", {
      table: visibleModule.table,
      companyId: tenant.companyId,
      message: caughtError instanceof Error ? caughtError.message : "Unknown error"
    });
    listError = "No se pudieron cargar los registros recientes.";
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <visibleModule.icon className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{visibleModule.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {visibleModule.description}
          </p>
        </div>
        <Badge variant="secondary">{rows.length} registros</Badge>
      </section>

      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo registro</CardTitle>
            <CardDescription>Completa los campos requeridos para crear un registro.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {visibleModule.table === "users" ? (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Esto crea un registro interno de referencia (nombre, correo, rol), pero no una cuenta con
                acceso a la plataforma. La persona no podrá iniciar sesión hasta que se le invite formalmente.
              </div>
            ) : null}
            <TenantRecordForm
              fields={visibleModule.fields}
              table={visibleModule.table}
              redirectTo={visibleModule.href}
              companyName={settings.companyName}
              companyId={tenant.companyId}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registros recientes</CardTitle>
            <CardDescription>Información privada de tu empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="q">Buscar</Label>
                <Input
                  id="q"
                  name="q"
                  defaultValue={searchValue}
                  placeholder={searchField ? `Buscar por ${visibleModule.fields[0].label}` : "Buscar"}
                />
              </div>
              {filterField ? (
                <div className="w-full space-y-2 sm:w-56">
                  <Label htmlFor="status">{filterField.label}</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={statusValue}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Todos</option>
                    {(filterField.options ?? []).map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" variant="outline">
                  Buscar
                </Button>
                {searchValue || statusValue ? (
                  <Link
                    href={visibleModule.href}
                    className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
                  >
                    Limpiar
                  </Link>
                ) : null}
              </div>
            </form>
            {listError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {listError}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                {visibleModule.empty}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map((field) => (
                      <TableHead key={field.name}>{field.label}</TableHead>
                    ))}
                    <TableHead>Creado</TableHead>
                    {visibleModule.table === "asset_documents" || canDelete || canEdit ? (
                      <TableHead>Acciones</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={String(row.id)}>
                      {visibleColumns.map((field) => (
                        <TableCell key={field.name}>
                          {visibleModule.table === "assets" && field.name === "name" ? (
                            <Link className="font-medium text-primary hover:underline" href={`/activos/${row.id}`}>
                              {renderCell(row[field.name], field)}
                            </Link>
                          ) : (
                            renderCell(row[field.name], field, filterField?.name === field.name)
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-muted-foreground">
                        {formatDate(String(row.created_at ?? ""))}
                      </TableCell>
                      {visibleModule.table === "asset_documents" || canDelete || canEdit ? (
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {canEdit ? (
                              <TenantRecordEditButton
                                fields={visibleModule.fields}
                                table={visibleModule.table as ModuleKey}
                                redirectTo={visibleModule.href}
                                companyName={settings.companyName}
                                companyId={tenant.companyId}
                                recordId={String(row.id)}
                                record={row}
                                recordLabel={String(row[visibleModule.fields[0].name] ?? "este registro")}
                              />
                            ) : null}
                            {visibleModule.table === "asset_documents" ? (
                              <DocumentActions
                                id={String(row.id)}
                                filePath={row.file_path ? String(row.file_path) : null}
                                fileName={row.file_name ? String(row.file_name) : null}
                              />
                            ) : canDelete ? (
                              <TenantRecordDeleteButton
                                table={visibleModule.table as ModuleKey}
                                recordId={String(row.id)}
                                recordLabel={String(row[visibleModule.fields[0].name] ?? "este registro")}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// Generic keyword heuristic (not a per-module lookup table) so every status/
// role enum across every module - present or future - gets a sensible color
// without hand-maintaining a mapping per value.
function statusBadgeVariant(rawValue: string): "default" | "warning" | "destructive" | "secondary" {
  const value = rawValue.toUpperCase();
  if (/CANCEL|RETIRED|LOST|OVERDUE|INACTIVE|VENCID/.test(value)) return "destructive";
  if (/COMPLET|RESUELTO|CERRADO|AVAILABLE|DISPONIBLE|^ACTIVE$/.test(value)) return "default";
  if (/PENDING|SCHEDULED|PROGRESS|MAINTENANCE|PROCESO|ABIERTO|PROGRAMAD/.test(value)) return "warning";
  return "secondary";
}

function renderCell(value: TenantRow[string], field: ModuleField, isStatusLike = false) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  const label = field.enumKey
    ? getEnumLabel(field.enumKey, value)
    : field.options
      ? field.options.find((option) => option.value === String(value))?.label ?? String(value)
      : field.type === "date"
        ? formatDate(String(value))
        : String(value);

  if (isStatusLike && (field.enumKey || field.options)) {
    return <Badge variant={statusBadgeVariant(String(value))}>{label}</Badge>;
  }
  return label;
}

async function withRelationOptions(module: ModuleConfig, companyId: string): Promise<ModuleConfig> {
  const relationFields = new Set(module.fields.filter((field) => field.type === "uuid").map((field) => field.name));
  if (relationFields.size === 0) return module;

  const supabase = await createClient();
  const [assets, projects, maintenance] = await Promise.all([
    relationFields.has("asset_id")
      ? supabase.from("assets").select("id,name,code").eq("company_id", companyId).order("name").limit(100)
      : Promise.resolve({ data: [], error: null }),
    relationFields.has("project_id")
      ? supabase.from("projects").select("id,name,code").eq("company_id", companyId).order("name").limit(100)
      : Promise.resolve({ data: [], error: null }),
    relationFields.has("maintenance_record_id")
      ? supabase.from("maintenance_records").select("id,title").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (assets.error || projects.error || maintenance.error) {
    console.warn("Relation options failed to load", {
      assets: assets.error?.message,
      projects: projects.error?.message,
      maintenance: maintenance.error?.message
    });
  }

  return {
    ...module,
    fields: module.fields.map((field) => {
      if (field.name === "asset_id") {
        return {
          ...field,
          options: (assets.data ?? []).map((asset) => ({
            value: asset.id,
            label: `${asset.name}${asset.code ? ` (${asset.code})` : ""}`
          }))
        };
      }

      if (field.name === "project_id") {
        return {
          ...field,
          options: (projects.data ?? []).map((project) => ({
            value: project.id,
            label: `${project.name}${project.code ? ` (${project.code})` : ""}`
          }))
        };
      }

      if (field.name === "maintenance_record_id") {
        return {
          ...field,
          options: (maintenance.data ?? []).map((record) => ({
            value: record.id,
            label: record.title
          }))
        };
      }

      return field;
    })
  };
}
