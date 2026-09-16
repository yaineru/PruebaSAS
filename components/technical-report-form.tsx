"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { generateTechnicalReport, getMaintenanceTechnicalDetails } from "@/lib/actions/technical-reports";
import { ENUM_OPTIONS } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { Loader, FileText, CheckCircle, AlertCircle, ImageIcon, Plus, Trash2 } from "lucide-react";

type Props = {
  companyId: string;
};

type MaintenanceOption = {
  id: string;
  title: string;
  description?: string | null;
  maintenance_date?: string | null;
};

type EvidenceType = "BEFORE" | "AFTER" | "EVIDENCE";

type EvidencePhoto = {
  title: string;
  url: string;
  type: EvidenceType;
};

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  BEFORE: "Antes",
  AFTER: "Después",
  EVIDENCE: "Evidencia",
};

const MAX_EVIDENCE_MB = 8;
// Antes eran "6 pares" (Antes+Después) = 12 fotos como tope real. Ahora que
// cada foto es independiente (no forma parejas), el tope se expresa
// directamente en fotos individuales mantiene el mismo máximo real de 12.
const MAX_EVIDENCE_ITEMS = 12;

/**
 * Evidence photos upload straight from the browser to Storage (see the
 * comment on handleSelect below for why), so they never pass through the
 * server-side sharp pipeline that already compresses asset gallery photos
 * (lib/actions/asset-images.ts) - camera-resolution originals (often 3-8MB)
 * were going to Storage untouched. Re-encoding client-side via Canvas before
 * upload mirrors that same server-side treatment (resize to fit 1600px,
 * re-encode as WebP) without adding a server round trip.
 */
async function compressImageForUpload(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    // Any failure (unsupported format, decode error) falls back to the
    // original file rather than blocking the upload - compression is an
    // optimization, not a requirement.
    return file;
  }
}

function EvidencePicker({
  label,
  companyId,
  initialUrl,
  onUploaded,
}: {
  label: string;
  companyId: string;
  initialUrl: string;
  onUploaded: (url: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const supabase = createClient();

  // Evidence photos used to travel as raw Files inside the Server Action's
  // FormData, which broke in two independent ways in production: Vercel
  // caps a serverless function's request body well below the 8 MB/file this
  // form allowed, and the action itself used to write the bytes to the local
  // filesystem (read-only on Vercel). Uploading straight from the browser to
  // the private "reports" bucket - the same pattern already used for
  // documents - avoids both: only a short signed URL string ever reaches the
  // Server Action.
  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Solo se aceptan JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_EVIDENCE_MB * 1024 * 1024) {
      setUploadError(`La imagen supera el tamaño máximo de ${MAX_EVIDENCE_MB} MB.`);
      event.target.value = "";
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uploadFile = await compressImageForUpload(file);
      const ext = uploadFile.type === "image/png" ? "png" : uploadFile.type === "image/webp" ? "webp" : "jpg";
      const path = `${companyId}/technical/evidence/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("reports").upload(path, uploadFile, { contentType: uploadFile.type });
      if (uploadErr) throw uploadErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("reports")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr || new Error("No se pudo generar el enlace.");

      onUploaded(signed.signedUrl);
    } catch {
      setUploadError("No se pudo subir la imagen. Intenta de nuevo.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview || initialUrl || null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-lg border-2 border-dashed p-3">
        {displayUrl ? (
          <img src={displayUrl} alt={label} className="h-32 w-full rounded-md object-cover" />
        ) : (
          <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="mb-1 h-6 w-6" />
            <p className="text-xs">Sin imagen</p>
          </div>
        )}
        <label className="mt-2 block cursor-pointer text-center text-xs text-primary hover:underline">
          {uploading ? "Subiendo..." : displayUrl ? "Cambiar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={handleSelect}
          />
        </label>
        {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
      </div>
    </div>
  );
}

export function TechnicalReportForm({ companyId }: Props) {
  const [maintenances, setMaintenances] = useState<MaintenanceOption[]>([]);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, string>>({
    reportDate: new Date().toISOString().slice(0, 10),
    clientName: "",
    clientContact: "",
    projectName: "",
    projectLocation: "",
    equipment: "",
    assetCode: "",
    assetBrandModel: "",
    equipmentStatus: "",
    responsibleName: "",
    technicianName: "",
    activityType: "",
    problemDescription: "",
    diagnosis: "",
    workActivity: "",
    procedure: "",
    materialsUsed: "",
    sparePartsUsed: "",
    observations: "",
    recommendations: "",
  });
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const loadMaintenances = async () => {
      const { data } = await supabase
        .from("maintenance_records")
        .select("id, title, description, maintenance_date")
        .eq("company_id", companyId)
        .order("maintenance_date", { ascending: false })
        .limit(50);

      setMaintenances((data || []) as MaintenanceOption[]);
    };

    loadMaintenances();
  }, [companyId, supabase]);

  const handleMaintenanceChange = async (maintenanceId: string) => {
    setSelectedMaintenanceId(maintenanceId);
    if (!maintenanceId) return;

    const result = await getMaintenanceTechnicalDetails(maintenanceId);
    if (result.success && result.maintenance) {
      setFormState((prev) => ({
        ...prev,
        projectName: result.maintenance.projectName || prev.projectName,
        projectLocation: result.maintenance.projectLocation || prev.projectLocation,
        equipment: result.maintenance.assetName || prev.equipment,
        assetCode: result.maintenance.assetCode || prev.assetCode,
        assetBrandModel: result.maintenance.assetBrandModel || prev.assetBrandModel,
        equipmentStatus: result.maintenance.assetStatus || prev.equipmentStatus,
        responsibleName: result.maintenance.responsibleName || prev.responsibleName,
        technicianName: result.maintenance.technicianName || prev.technicianName,
        activityType: result.maintenance.type || prev.activityType,
        problemDescription: result.maintenance.description || prev.problemDescription,
        workActivity: result.maintenance.title || prev.workActivity,
        observations: result.maintenance.observations || prev.observations,
      }));
      // El mantenimiento seleccionado puede traer su propio Antes/Después
      // (maintenance_records.evidence_before_url/after_url, un campo previo
      // y más simple que la evidencia del informe técnico). Se agregan como
      // fotos independientes con su tipo correspondiente - reemplazando solo
      // las que se hayan agregado automáticamente antes (para no duplicar si
      // el usuario cambia de mantenimiento varias veces), nunca las que el
      // usuario subió a mano.
      const autoTitle = "Evidencia del mantenimiento";
      if (result.maintenance.evidenceBeforeUrl || result.maintenance.evidenceAfterUrl) {
        setEvidencePhotos((prev) => {
          const manual = prev.filter((p) => p.title !== autoTitle);
          const auto: EvidencePhoto[] = [];
          if (result.maintenance.evidenceBeforeUrl) {
            auto.push({ title: autoTitle, url: result.maintenance.evidenceBeforeUrl, type: "BEFORE" });
          }
          if (result.maintenance.evidenceAfterUrl) {
            auto.push({ title: autoTitle, url: result.maintenance.evidenceAfterUrl, type: "AFTER" });
          }
          return [...auto, ...manual].slice(0, MAX_EVIDENCE_ITEMS);
        });
      }
    }
  };

  const addEvidencePhoto = () => {
    // El tipo por defecto es "Evidencia": es el caso más genérico y no debe
    // obligar a la persona a pensar en Antes/Después antes de subir la foto.
    setEvidencePhotos((prev) => (prev.length >= MAX_EVIDENCE_ITEMS ? prev : [...prev, { title: "", url: "", type: "EVIDENCE" }]));
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEvidencePhoto = (index: number, patch: Partial<EvidencePhoto>) => {
    setEvidencePhotos((prev) => prev.map((photo, i) => (i === index ? { ...photo, ...patch } : photo)));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    Object.entries(formState).forEach(([key, value]) => {
      if (value) formData.set(key, value);
    });
    if (selectedMaintenanceId) formData.set("maintenanceId", selectedMaintenanceId);
    // Solo las fotos que realmente tienen una imagen subida viajan al
    // servidor - una fila agregada y luego dejada vacía (o cuya subida
    // falló) no debe generar un item de evidencia sin imagen.
    const photosToSubmit = evidencePhotos.filter((photo) => photo.url);
    formData.set("evidenceCount", String(photosToSubmit.length));
    photosToSubmit.forEach((photo, index) => {
      formData.set(`evidenceTitle_${index}`, photo.title);
      formData.set(`evidenceUrl_${index}`, photo.url);
      formData.set(`evidenceType_${index}`, photo.type);
    });

    try {
      const result = await generateTechnicalReport(formData);
      if (result.success) {
        setMessage(result.message || "Informe técnico generado correctamente.");
      } else {
        setError(result.error || "No fue posible generar el informe técnico.");
      }
    } catch {
      // Without this, a framework-level rejection (request too large, network
      // failure, etc.) left the button stuck on "Generando..." forever, since
      // setIsLoading(false) was only reached on the happy path.
      setError("No fue posible generar el informe técnico. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo informe técnico</CardTitle>
          <CardDescription>Completa el formulario y genera un PDF listo para entregar al cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Mantenimiento asociado</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedMaintenanceId}
                onChange={(event) => handleMaintenanceChange(event.target.value)}
              >
                <option value="">Selecciona un mantenimiento existente</option>
                {maintenances.map((maintenance) => (
                  <option key={maintenance.id} value={maintenance.id}>
                    {maintenance.title} · {maintenance.maintenance_date || "Sin fecha"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Al seleccionar un mantenimiento, se autocompletan proyecto, equipo, estado, responsable y observaciones. Solo debes completar los datos propios del servicio.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-semibold">Información del cliente</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reportDate">Fecha</Label>
                  <Input id="reportDate" name="reportDate" type="date" value={formState.reportDate} onChange={(e) => setFormState((prev) => ({ ...prev, reportDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Cliente *</Label>
                  <Input id="clientName" name="clientName" required placeholder="Empresa o persona que recibe el servicio" value={formState.clientName} onChange={(e) => setFormState((prev) => ({ ...prev, clientName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientContact">Contacto del cliente</Label>
                <Input id="clientContact" name="clientContact" placeholder="Nombre de quien recibe el informe" value={formState.clientContact} onChange={(e) => setFormState((prev) => ({ ...prev, clientContact: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-semibold">Información del proyecto y equipo</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Proyecto / Obra</Label>
                  <Input id="projectName" name="projectName" value={formState.projectName} onChange={(e) => setFormState((prev) => ({ ...prev, projectName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectLocation">Ubicación / Sede</Label>
                  <Input id="projectLocation" name="projectLocation" value={formState.projectLocation} onChange={(e) => setFormState((prev) => ({ ...prev, projectLocation: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="equipment">Equipo intervenido</Label>
                  <Input id="equipment" name="equipment" value={formState.equipment} onChange={(e) => setFormState((prev) => ({ ...prev, equipment: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assetCode">Código del equipo</Label>
                  <Input id="assetCode" name="assetCode" value={formState.assetCode} onChange={(e) => setFormState((prev) => ({ ...prev, assetCode: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assetBrandModel">Marca / Modelo</Label>
                  <Input id="assetBrandModel" name="assetBrandModel" value={formState.assetBrandModel} onChange={(e) => setFormState((prev) => ({ ...prev, assetBrandModel: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipmentStatus">Estado del equipo</Label>
                  <select
                    id="equipmentStatus"
                    name="equipmentStatus"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formState.equipmentStatus}
                    onChange={(e) => setFormState((prev) => ({ ...prev, equipmentStatus: e.target.value }))}
                  >
                    <option value="">Selecciona un estado</option>
                    {ENUM_OPTIONS.assetStatus.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-semibold">Responsables del servicio</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="responsibleName">Responsable del mantenimiento</Label>
                  <Input id="responsibleName" name="responsibleName" placeholder="Quien coordina o autoriza el servicio" value={formState.responsibleName} onChange={(e) => setFormState((prev) => ({ ...prev, responsibleName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technicianName">Técnico que realizó el trabajo</Label>
                  <Input id="technicianName" name="technicianName" value={formState.technicianName} onChange={(e) => setFormState((prev) => ({ ...prev, technicianName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activityType">Tipo de mantenimiento</Label>
                <select
                  id="activityType"
                  name="activityType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formState.activityType}
                  onChange={(e) => setFormState((prev) => ({ ...prev, activityType: e.target.value }))}
                >
                  <option value="">Selecciona un tipo</option>
                  {ENUM_OPTIONS.maintenanceType.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="problemDescription">Descripción del problema *</Label>
              <textarea id="problemDescription" name="problemDescription" required rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.problemDescription} onChange={(e) => setFormState((prev) => ({ ...prev, problemDescription: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnóstico</Label>
              <textarea id="diagnosis" name="diagnosis" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.diagnosis} onChange={(e) => setFormState((prev) => ({ ...prev, diagnosis: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workActivity">Actividades realizadas</Label>
              <textarea id="workActivity" name="workActivity" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.workActivity} onChange={(e) => setFormState((prev) => ({ ...prev, workActivity: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="procedure">Procedimiento ejecutado</Label>
              <textarea id="procedure" name="procedure" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.procedure} onChange={(e) => setFormState((prev) => ({ ...prev, procedure: e.target.value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="materialsUsed">Materiales utilizados</Label>
                <textarea id="materialsUsed" name="materialsUsed" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.materialsUsed} onChange={(e) => setFormState((prev) => ({ ...prev, materialsUsed: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sparePartsUsed">Repuestos utilizados</Label>
                <textarea id="sparePartsUsed" name="sparePartsUsed" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.sparePartsUsed} onChange={(e) => setFormState((prev) => ({ ...prev, sparePartsUsed: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observaciones</Label>
              <textarea id="observations" name="observations" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.observations} onChange={(e) => setFormState((prev) => ({ ...prev, observations: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendations">Recomendaciones</Label>
              <textarea id="recommendations" name="recommendations" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.recommendations} onChange={(e) => setFormState((prev) => ({ ...prev, recommendations: e.target.value }))} />
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Evidencia fotográfica</p>
                  <p className="text-xs text-muted-foreground">
                    Agrega las fotos que necesites y marca cada una como Antes, Después o Evidencia. No es obligatorio
                    formar parejas Antes/Después.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addEvidencePhoto} disabled={evidencePhotos.length >= MAX_EVIDENCE_ITEMS}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Agregar foto
                </Button>
              </div>
              {evidencePhotos.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Aún no has agregado fotos. Usa &quot;Agregar foto&quot; para empezar.
                </p>
              ) : null}
              {evidencePhotos.map((photo, index) => (
                <div key={index} className="space-y-2 rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder={`Título de la foto ${index + 1} (opcional)`}
                      value={photo.title}
                      onChange={(e) => updateEvidencePhoto(index, { title: e.target.value })}
                    />
                    <div className="space-y-1">
                      <Label htmlFor={`evidence-type-${index}`} className="sr-only">
                        Tipo de foto {index + 1}
                      </Label>
                      <select
                        id={`evidence-type-${index}`}
                        value={photo.type}
                        onChange={(e) => updateEvidencePhoto(index, { type: e.target.value as EvidenceType })}
                        className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {(Object.keys(EVIDENCE_TYPE_LABELS) as EvidenceType[]).map((type) => (
                          <option key={type} value={type}>
                            {EVIDENCE_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeEvidencePhoto(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <EvidencePicker
                    label={`Foto (${EVIDENCE_TYPE_LABELS[photo.type]})`}
                    companyId={companyId}
                    initialUrl={photo.url}
                    onUploaded={(url) => updateEvidencePhoto(index, { url })}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SignaturePad label="Firma del técnico" name="technicalSignature" defaultName={formState.technicianName} />
              <SignaturePad label="Firma del cliente" name="clientSignature" defaultName={formState.clientContact} />
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {message ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4" />
                <span>{message}</span>
              </div>
            ) : null}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Generando...</> : <><FileText className="mr-2 h-4 w-4" /> Generar informe técnico</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle>Documento entregable al cliente</CardTitle>
          <CardDescription>Logo, encabezado, información del cliente y del proyecto, evidencia fotográfica, firmas y pie de página corporativo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• Se integra con activos, mantenimientos, usuarios y empresas.</p>
          <p>• Al elegir un mantenimiento, el sistema autocompleta proyecto, equipo, responsable y observaciones.</p>
          <p>• Las firmas se capturan a mano (mouse o dedo) y se incrustan como imagen en el PDF.</p>
          <p>• El PDF se guarda para descarga y se registra en el historial de informes.</p>
        </CardContent>
      </Card>
    </div>
  );
}
