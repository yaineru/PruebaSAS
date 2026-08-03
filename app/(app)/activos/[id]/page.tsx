import { notFound } from "next/navigation";
import { Archive, CalendarCheck, Camera, FileText, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { getEnumLabel } from "@/lib/enums";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetImageGallery, type GalleryComparison, type GalleryImage } from "@/components/asset-image-gallery";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await getTenantContext();
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("company_id", tenant.companyId)
    .eq("id", id)
    .single();

  if (!asset) notFound();

  const [{ data: maintenance }, { data: documents }, { data: assetImages }, { data: imageComparisons }] = await Promise.all([
    supabase
      .from("maintenance_records")
      .select("id,title,maintenance_date,type,description,cost,responsible_name,status")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("maintenance_date", { ascending: false })
      .limit(20),
    supabase
      .from("asset_documents")
      .select("id,title,type,expires_at,status,url")
      .eq("company_id", tenant.companyId)
      .eq("asset_id", id)
      .order("expires_at", { ascending: true })
      .limit(20),
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
      <section className="rounded-md border bg-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Archive className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{asset.name}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {asset.location ?? "Sin ubicación"}
            </p>
          </div>
          <Badge variant="secondary">{getEnumLabel("assetStatus", asset.status)}</Badge>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Ficha técnica</CardTitle>
            <CardDescription>Datos operativos, identificación y vencimientos críticos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div className="rounded-md border p-3" key={String(label)}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-medium">{value ?? "-"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <CardTitle>Historial de mantenimientos</CardTitle>
            </div>
            <CardDescription>Timeline de intervenciones, responsables y costos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(maintenance ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay mantenimientos registrados para esta máquina.
              </p>
            ) : (
              maintenance?.map((item) => (
                <div className="relative border-l pl-4" key={item.id}>
                  <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-primary" />
                  <div className="rounded-md border p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(item.maintenance_date)} - {getEnumLabel("maintenanceType", item.type)}
                        </p>
                      </div>
                      <Badge variant="secondary">{getEnumLabel("maintenanceStatus", item.status)}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{item.description ?? "Sin descripción"}</p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <span>Responsable: {item.responsible_name ?? "-"}</span>
                      <span>Costo: {Number(item.cost ?? 0).toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
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
            <FileText className="h-4 w-4 text-primary" />
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
                <p className="font-medium">{document.title}</p>
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
