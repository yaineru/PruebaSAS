import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Camera, FileText, FolderKanban, History, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { getCompanySettings } from "@/lib/company-settings";
import { getEnumLabel } from "@/lib/enums";
import { formatDate, timelineTimestamp } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetImageGallery, type GalleryComparison, type GalleryImage } from "@/components/asset-image-gallery";
import { AssetHistoryTimeline, type AssetTimelineItem } from "@/components/asset-history-timeline";
import { getMissingAssetFields } from "@/lib/asset-completeness";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProjectRef = { id: string; name: string; code: string | null } | null;

export default async function AssetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await getTenantContext();
  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("company_id", tenant.companyId)
    .eq("id", id)
    .single();

  if (!asset) notFound();

  // El proyecto se consulta aparte en vez de con un embed
  // (`select("*, project:project_id(...)")`) a propósito: un embed sobre una
  // columna que todavía no existe hace fallar TODA la consulta, así que la
  // ficha del equipo quedaría en 404 en cualquier instancia donde la
  // migración 047 aún no se haya aplicado. `select("*")` devuelve project_id
  // si existe y lo omite si no, sin romper nada.
  let project: ProjectRef = null;
  if (asset.project_id) {
    const { data: projectRow } = await supabase
      .from("projects")
      .select("id,name,code")
      .eq("company_id", tenant.companyId)
      .eq("id", asset.project_id)
      .maybeSingle();
    project = projectRow ?? null;
  }

  const [
    { data: maintenance },
    { data: documents },
    { data: incidents },
    { data: historyEntries, error: historyError },
    { data: assetImages },
    { data: imageComparisons }
  ] = await Promise.all([
    supabase
      .from("maintenance_records")
      .select("id,title,maintenance_date,type,description,cost,responsible_name,status,project:project_id(name)")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("maintenance_date", { ascending: false })
      .limit(50),
    supabase
      .from("asset_documents")
      .select("id,title,type,expires_at,status,url,created_at")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("expires_at", { ascending: true })
      .limit(50),
    supabase
      .from("incidents")
      .select("id,title,description,priority,status,reported_at,location,project:project_id(name)")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("reported_at", { ascending: false })
      .limit(50),
    // asset_history (migración 047). Se consulta con su propio error en vez
    // de dejar que un fallo tire la página entera: si la migración todavía no
    // se aplicó, el resto de la ficha (y el historial de mantenimientos, que
    // ya funcionaba) tiene que seguir cargando igual.
    supabase
      .from("asset_history")
      .select("id,title,description,event_type,performed_at,performed_by_name,cost,hour_meter,project:project_id(name)")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("asset_images")
      .select("id,file_path,title,image_type,created_at")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("image_comparisons")
      .select("id,before_image_id,after_image_id,notes,before:asset_images!image_comparisons_before_image_id_fkey(file_path),after:asset_images!image_comparisons_after_image_id_fkey(file_path)")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (historyError) {
    console.warn("Asset history unavailable", {
      assetId: id,
      code: historyError.code,
      message: historyError.message
    });
  }

  // PostgREST returns a single embedded object for a many-to-one FK join
  // (each comparison references exactly one before/after asset_images row),
  // but without generated DB types the query builder can't infer that
  // cardinality and boxes it as an array - cast to the real runtime shape.
  type ImageComparisonRow = {
    id: string;
    notes: string | null;
    before: { file_path: string } | null;
    after: { file_path: string } | null;
  };
  const comparisonRows = ((imageComparisons || []) as unknown as ImageComparisonRow[]).filter(
    (comparison) => comparison.before?.file_path && comparison.after?.file_path
  );

  // A gallery/comparison history can grow to dozens of photos over an
  // asset's lifetime - signing each path with its own createSignedUrl() call
  // meant up to ~100 separate Storage round trips on this one page. Supabase
  // Storage's createSignedUrls() (plural) takes the whole path list in a
  // single request; build one lookup map from it instead.
  const allPaths = [
    ...(assetImages || []).map((image) => image.file_path),
    ...comparisonRows.flatMap((c) => [c.before!.file_path, c.after!.file_path])
  ];
  const uniquePaths = Array.from(new Set(allPaths));
  const signedUrlByPath = new Map<string, string>();
  if (uniquePaths.length > 0) {
    const { data: signedBatch } = await supabase.storage.from("company-files").createSignedUrls(uniquePaths, 3600);
    for (const entry of signedBatch ?? []) {
      if (entry.path && entry.signedUrl) signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }

  const galleryImages: GalleryImage[] = (assetImages || []).map((image) => ({
    id: image.id,
    url: signedUrlByPath.get(image.file_path) || "",
    title: image.title,
    imageType: image.image_type,
    createdAt: image.created_at
  }));

  const galleryComparisons: GalleryComparison[] = comparisonRows.map((comparison) => ({
    id: comparison.id,
    beforeUrl: signedUrlByPath.get(comparison.before!.file_path) || "",
    afterUrl: signedUrlByPath.get(comparison.after!.file_path) || "",
    notes: comparison.notes
  }));

  // Un solo timeline con las cuatro fuentes de "qué se le ha hecho al
  // equipo". Se arma en el servidor (donde ya están los datos) y se ordena
  // por la fecha del HECHO, no por created_at: un mantenimiento del mes
  // pasado que se registró hoy pertenece al mes pasado en la cronología.
  const timeline: AssetTimelineItem[] = [
    ...(historyEntries ?? []).map((entry) => ({
      id: entry.id,
      source: "HISTORY" as const,
      date: entry.performed_at,
      title: entry.title,
      typeLabel: getEnumLabel("assetHistoryEventType", entry.event_type),
      statusLabel: null,
      description: entry.description,
      person: entry.performed_by_name,
      cost: entry.cost === null ? null : Number(entry.cost),
      hourMeter: entry.hour_meter === null ? null : Number(entry.hour_meter),
      projectName: embeddedName(entry.project),
      href: null
    })),
    ...(maintenance ?? []).map((item) => ({
      id: item.id,
      source: "MAINTENANCE" as const,
      date: item.maintenance_date,
      title: item.title,
      typeLabel: getEnumLabel("maintenanceType", item.type),
      statusLabel: getEnumLabel("maintenanceStatus", item.status),
      description: item.description,
      person: item.responsible_name,
      cost: item.cost === null ? null : Number(item.cost),
      hourMeter: null,
      projectName: embeddedName(item.project),
      href: "/mantenimientos"
    })),
    ...(incidents ?? []).map((item) => ({
      id: item.id,
      source: "INCIDENT" as const,
      date: item.reported_at,
      title: item.title,
      typeLabel: getEnumLabel("incidentPriority", item.priority),
      statusLabel: getEnumLabel("incidentStatus", item.status),
      description: item.description,
      person: null,
      cost: null,
      hourMeter: null,
      projectName: embeddedName(item.project) ?? item.location,
      href: "/novedades"
    })),
    ...(documents ?? []).map((item) => ({
      id: item.id,
      source: "DOCUMENT" as const,
      // Un documento entra a la cronología el día que se cargó; su
      // expires_at es una fecha futura y lo dejaría flotando arriba del
      // timeline como si fuera lo último que pasó.
      date: item.created_at,
      title: item.title,
      typeLabel: getEnumLabel("documentType", item.type),
      statusLabel: null,
      description: item.expires_at ? `Vence el ${formatDate(item.expires_at)}` : null,
      person: null,
      cost: null,
      hourMeter: null,
      projectName: null,
      href: "/documentos"
    }))
  ].sort((a, b) => timelineTimestamp(b.date) - timelineTimestamp(a.date));

  const missingFields = getMissingAssetFields(asset);
  const assetLabel = settings.assetLabel;

  // Misma escala que las policies de asset_history (migración 047) y que
  // lib/actions/asset-history.ts: anotar puede cualquier miembro operativo
  // (el operario es quien sabe qué se le hizo), borrar solo un administrador.
  const canAddEntry = ["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "OPERARIO"].includes(tenant.role);
  const canDeleteEntry = ["SUPER_ADMIN", "ADMIN"].includes(tenant.role);

  const details = [
    ["Código interno", asset.code],
    ["Placa", asset.plate],
    ["Serial", asset.serial_number],
    ["Marca", asset.brand],
    ["Modelo", asset.model],
    ["Año", asset.year],
    ["Proveedor", asset.provider],
    ["Horómetro", asset.hour_meter],
    ["Último mantenimiento", formatDate(asset.last_maintenance_date)],
    ["Próximo mantenimiento", formatDate(asset.next_maintenance_date)],
    ["Vence póliza", formatDate(asset.insurance_expiration)],
    ["Vence certificado", formatDate(asset.technical_certificate_expiration)]
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-md border bg-card p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Archive className="h-5 w-5" />
            </div>
            <Link
              href="/activos"
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              ← Volver a {assetLabel}
            </Link>
            <h1 className="mt-1 break-words text-2xl font-semibold tracking-normal sm:text-3xl">{asset.name}</h1>
            <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {asset.location ?? "Sin ubicación"}
              </span>
              <span className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 shrink-0" />
                {project ? (
                  <Link className="text-primary hover:underline" href={`/activos?project=${project.id}`}>
                    {project.name}
                    {project.code ? ` (${project.code})` : ""}
                  </Link>
                ) : (
                  "Sin proyecto asignado"
                )}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="self-start lg:self-auto">
            {getEnumLabel("assetStatus", asset.status)}
          </Badge>
        </div>
        {missingFields.length > 0 ? (
          <div className="mt-4 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-accent-foreground">
            <p className="font-medium">⚠ Información pendiente</p>
            <p className="mt-1 text-muted-foreground">
              Faltan: {missingFields.join(", ")}. Puedes completarlos desde {assetLabel} → Editar cuando tengas esos
              datos.
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Ficha técnica</CardTitle>
            <CardDescription>Datos operativos, identificación y vencimientos críticos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Proyecto / obra</p>
                <p className="mt-1 break-words text-sm font-medium">
                  {project ? (
                    <Link className="text-primary hover:underline" href={`/activos?project=${project.id}`}>
                      {project.name}
                      {project.code ? ` (${project.code})` : ""}
                    </Link>
                  ) : (
                    "Sin asignar"
                  )}
                </p>
              </div>
              {details.map(([label, value]) => (
                <div className="rounded-md border p-3" key={String(label)}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium">{value ?? "-"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 shrink-0 text-primary" />
              <CardTitle>Historial del equipo</CardTitle>
            </div>
            <CardDescription>
              Todo lo que se le ha hecho a esta máquina: intervenciones del día a día, mantenimientos, novedades y
              documentos, en una sola línea de tiempo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyError ? (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                El registro libre de intervenciones aún no está habilitado en la base de datos (falta aplicar la
                migración 047). Mientras tanto se muestran mantenimientos, novedades y documentos.
              </div>
            ) : null}
            <AssetHistoryTimeline
              assetId={asset.id}
              assetName={asset.name}
              items={timeline}
              canAddEntry={canAddEntry && !historyError}
              canDeleteEntry={canDeleteEntry}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 shrink-0 text-primary" />
            <CardTitle>Fotografías</CardTitle>
          </div>
          <CardDescription>Fotos del equipo, con comparación antes/después cuando haya al menos dos imágenes.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssetImageGallery assetId={asset.id} images={galleryImages} comparisons={galleryComparisons} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <CardTitle>Documentos asociados</CardTitle>
          </div>
          <CardDescription>Certificados, polizas, manuales y archivos con vencimiento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(documents ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              No hay documentos asociados a este equipo.
            </p>
          ) : (
            documents?.map((document) => (
              <div className="rounded-md border p-4" key={document.id}>
                <p className="break-words font-medium">{document.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getEnumLabel("documentType", document.type)} - vence {formatDate(document.expires_at)}
                </p>
                <Badge className="mt-3" variant="secondary">{getEnumLabel("recordStatus", document.status)}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Los embeds de PostgREST (`project:project_id(name)`) llegan como objeto en
// tiempo de ejecución pero tipados como array cuando no hay tipos generados;
// este helper acepta ambas formas en vez de repetir el casteo en cada fuente
// del timeline.
function embeddedName(value: unknown): string | null {
  const entry = Array.isArray(value) ? value[0] : value;
  if (entry && typeof entry === "object" && "name" in entry) {
    const name = (entry as { name: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

