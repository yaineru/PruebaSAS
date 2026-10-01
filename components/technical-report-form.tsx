"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  generateTechnicalReport,
  getMaintenanceTechnicalDetails,
  getTechnicalReportForEdit,
  updateTechnicalReport,
} from "@/lib/actions/technical-reports";
import { ENUM_OPTIONS } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { Loader, FileText, CheckCircle, AlertCircle, ImageIcon, Plus, Trash2, CloudOff, Pencil } from "lucide-react";
import { useConnectivity } from "@/lib/offline/connectivity";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDb, type QueueFile } from "@/lib/offline/db";

type Props = {
  companyId: string;
  // Presente cuando se llega desde "Corregir" en components/report-list.tsx -
  // activa el modo edición: carga los datos del informe ya generado en vez
  // de restaurar un borrador local, y al enviar reemplaza ese mismo informe
  // en lugar de crear uno nuevo (ver updateTechnicalReport).
  editReportId?: string;
};

type MaintenanceOption = {
  id: string;
  title: string;
  description?: string | null;
  maintenance_date?: string | null;
};

type EvidenceType = "BEFORE" | "AFTER" | "EVIDENCE";

type EvidencePhoto = {
  clientId: string;
  title: string;
  url: string;
  type: EvidenceType;
  // Solo cuando la foto se guardó sin conexión: identifica el Blob en la
  // tabla `files` de Dexie (todavía no tiene URL real, se sube al sincronizar).
  pendingLocal?: boolean;
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

const TEXT_FIELD_NAMES = [
  "reportDate",
  "clientName",
  "clientContact",
  "projectName",
  "projectLocation",
  "equipment",
  "assetCode",
  "assetBrandModel",
  "equipmentStatus",
  "responsibleName",
  "technicianName",
  "activityType",
  "problemDescription",
  "procedure",
  "sparePartsUsed",
  "observations",
] as const;

const SIGNATURE_FIELD_NAMES = [
  "technicalSignatureImage",
  "technicalSignatureName",
  "technicalSignatureRole",
  "technicalSignatureDate",
  "clientSignatureImage",
  "clientSignatureName",
  "clientSignatureRole",
  "clientSignatureDate",
] as const;

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
  offline,
  onUploaded,
  onLocalFile,
}: {
  label: string;
  companyId: string;
  initialUrl: string;
  offline: boolean;
  onUploaded: (url: string) => void;
  onLocalFile: (file: File) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const supabase = createClient();

  const validate = (file: File): string | null => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return "Solo se aceptan JPG, PNG o WebP.";
    }
    if (file.size > MAX_EVIDENCE_MB * 1024 * 1024) {
      return `La imagen supera el tamaño máximo de ${MAX_EVIDENCE_MB} MB.`;
    }
    return null;
  };

  // Evidence photos used to travel as raw Files inside the Server Action's
  // FormData, which broke in two independent ways in production: Vercel
  // caps a serverless function's request body well below the 8 MB/file this
  // form allowed, and the action itself used to write the bytes to the local
  // filesystem (read-only on Vercel). Uploading straight from the browser to
  // the private "reports" bucket - the same pattern already used for
  // documents - avoids both: only a short signed URL string ever reaches the
  // Server Action. Offline, there is no server to reach at all yet - the
  // (already compressed) Blob is handed back to the parent, which stores it
  // in IndexedDB and uploads it later at sync time (lib/offline/sync.ts).
  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const validationError = validate(file);
    if (validationError) {
      setUploadError(validationError);
      event.target.value = "";
      return;
    }

    setPreview(URL.createObjectURL(file));

    if (offline) {
      setUploading(true);
      try {
        const compressed = await compressImageForUpload(file);
        onLocalFile(compressed);
      } finally {
        setUploading(false);
      }
      return;
    }

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
          {uploading ? (offline ? "Guardando..." : "Subiendo...") : displayUrl ? "Cambiar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={handleSelect}
          />
        </label>
        {offline && displayUrl ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
            <CloudOff className="h-3 w-3" /> Guardada en este dispositivo - se subirá al volver la conexión.
          </p>
        ) : null}
        {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
      </div>
    </div>
  );
}

const emptyFormState: Record<string, string> = {
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
  procedure: "",
  sparePartsUsed: "",
  observations: "",
};

export function TechnicalReportForm({ companyId, editReportId }: Props) {
  const isEditMode = Boolean(editReportId);
  const router = useRouter();
  const [maintenances, setMaintenances] = useState<MaintenanceOption[]>([]);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, string>>(emptyFormState);
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [signatureRestore, setSignatureRestore] = useState<Record<string, string>>({});
  // SignaturePad guarda el trazo dibujado solo en su propio estado interno,
  // sin ninguna forma externa de "limpiarlo" - cambiar su `key` fuerza a
  // React a desmontar y volver a montar el componente desde cero después de
  // un envío exitoso. Sin esto, la firma ya enviada seguía viva en el
  // canvas/input oculto y el autoguardado la tomaba como "contenido nuevo",
  // creando un borrador fantasma con esa firma vieja pero ningún otro dato.
  const [formResetCounter, setFormResetCounter] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const draftIdRef = useRef<string>(crypto.randomUUID());
  const supabase = createClient();
  const { isOnline } = useConnectivity();
  const { scopeKey } = useOffline();

  useEffect(() => {
    const loadMaintenances = async () => {
      try {
        const { data } = await supabase
          .from("maintenance_records")
          .select("id, title, description, maintenance_date")
          .eq("company_id", companyId)
          .order("maintenance_date", { ascending: false })
          .limit(50);

        if (data) {
          setMaintenances(data as MaintenanceOption[]);
          // Se guarda una copia mínima para poder mostrar el mismo selector
          // sin conexión (ver el catch más abajo) - ver lib/offline/db.ts,
          // reutiliza la misma cola como almacén de "catálogo" bajo un tipo
          // que runQueue nunca toca.
          const db = getOfflineDb(scopeKey);
          await db.operations.put({
            id: "__catalog_maintenances__",
            type: "CRUD",
            table: "__catalog__",
            action: undefined,
            payload: { list: JSON.stringify(data) },
            status: "SYNCED",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            attempts: 0,
            summary: "Catálogo de mantenimientos (offline)",
          });
        }
      } catch {
        // Sin conexión: se usa la última copia guardada del catálogo, si
        // existe, en vez de dejar el selector vacío.
        const db = getOfflineDb(scopeKey);
        const cached = await db.operations.get("__catalog_maintenances__");
        if (cached) {
          try {
            setMaintenances(JSON.parse(String(cached.payload.list)) as MaintenanceOption[]);
          } catch {
            // Copia corrupta o vacía - se ignora, el selector queda vacío.
          }
        }
      }
    };

    loadMaintenances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // En modo edición se carga el informe ya generado (ver "Corregir" en
  // components/report-list.tsx) en vez del borrador local - son dos orígenes
  // de datos mutuamente excluyentes, por eso el efecto de abajo (borrador
  // local) se salta por completo cuando hay un editReportId.
  useEffect(() => {
    if (!editReportId) return;

    (async () => {
      const result = await getTechnicalReportForEdit(editReportId);
      if (!result.success || !result.formPayload) {
        setEditLoadError(result.error || "No fue posible cargar el informe a corregir.");
        setDraftLoaded(true);
        return;
      }

      const payload = result.formPayload;
      setFormState((prev) => {
        const next = { ...prev };
        for (const key of TEXT_FIELD_NAMES) {
          if (payload[key] !== undefined) next[key] = payload[key];
        }
        return next;
      });
      if (payload.maintenanceId) setSelectedMaintenanceId(payload.maintenanceId);

      const signatures: Record<string, string> = {};
      for (const key of SIGNATURE_FIELD_NAMES) {
        if (payload[key]) signatures[key] = payload[key];
      }
      setSignatureRestore(signatures);

      const evidenceItems = (result.evidenceItems || []) as Array<{ title?: string; url?: string | null; type?: string }>;
      setEvidencePhotos(
        evidenceItems
          .filter((item) => item.url)
          .map((item) => ({
            clientId: crypto.randomUUID(),
            title: item.title || "",
            url: item.url as string,
            type: (item.type === "BEFORE" || item.type === "AFTER" ? item.type : "EVIDENCE") as EvidenceType,
          }))
      );

      setDraftLoaded(true);
    })();
  }, [editReportId]);

  // Al montar, revisa si ya hay un borrador guardado en este dispositivo
  // (ver el autosave más abajo) y lo restaura antes de mostrar el
  // formulario - las firmas (SignaturePad) solo leen su valor inicial una
  // vez al montar, así que el formulario no se muestra hasta que la
  // restauración (asíncrona, lee IndexedDB) termina.
  useEffect(() => {
    if (editReportId) return;

    (async () => {
      const db = getOfflineDb(scopeKey);
      const existingDraft = await db.operations
        .where("status")
        .equals("DRAFT")
        .and((op) => op.type === "CREATE_TECHNICAL_REPORT")
        .first();

      if (!existingDraft) {
        setDraftLoaded(true);
        return;
      }

      draftIdRef.current = existingDraft.id;
      const payload = existingDraft.payload as Record<string, string>;

      setFormState((prev) => {
        const next = { ...prev };
        for (const key of TEXT_FIELD_NAMES) {
          if (payload[key] !== undefined) next[key] = payload[key];
        }
        return next;
      });
      if (payload.__maintenanceId) setSelectedMaintenanceId(payload.__maintenanceId);

      const signatures: Record<string, string> = {};
      for (const key of SIGNATURE_FIELD_NAMES) {
        if (payload[key]) signatures[key] = payload[key];
      }
      setSignatureRestore(signatures);

      const files = await db.files.where("operationId").equals(existingDraft.id).toArray();
      const filesByClientId = new Map<string, QueueFile>(files.map((file) => [file.fieldName, file]));

      try {
        const restoredPhotos = JSON.parse(String(payload.__evidence || "[]")) as Array<{
          clientId: string;
          title: string;
          type: EvidenceType;
          url: string;
          pendingLocal?: boolean;
        }>;
        setEvidencePhotos(
          restoredPhotos.map((photo) => {
            if (photo.pendingLocal) {
              const file = filesByClientId.get(photo.clientId);
              return { ...photo, url: file ? URL.createObjectURL(file.blob) : "" };
            }
            return photo;
          })
        );
      } catch {
        // Sin fotos en el borrador o formato corrupto - se restaura vacío en
        // vez de romper la carga del resto del borrador.
      }

      setDraftRestoredNotice(true);
      setDraftLoaded(true);
    })();
    // editReportId no cambia durante la vida del componente (viene de un
    // query param leído una sola vez por la página) - no hace falta que
    // dispare este efecto de nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Espejos en ref de todo lo que el autoguardado necesita leer "al vuelo" -
  // el guardado corre en un setInterval creado UNA sola vez (ver más abajo),
  // así que si leyera formState/evidencePhotos/selectedMaintenanceId
  // directamente de los closures de React quedaría con los valores del
  // momento en que se creó el intervalo, no los más recientes. Esto importa
  // en particular para las firmas: SignaturePad guarda el trazo dibujado
  // solo en el DOM (un input oculto), nunca en el estado de React de este
  // componente - si el autoguardado solo reaccionara a cambios de formState/
  // evidencePhotos (vía un efecto con esas dependencias), dibujar una firma
  // DESPUÉS del último cambio a esos campos nunca dispararía un nuevo
  // guardado y la firma se perdería en un cierre/recarga inesperados.
  const formStateRef = useRef(formState);
  formStateRef.current = formState;
  const evidencePhotosRef = useRef(evidencePhotos);
  evidencePhotosRef.current = evidencePhotos;
  const selectedMaintenanceIdRef = useRef(selectedMaintenanceId);
  selectedMaintenanceIdRef.current = selectedMaintenanceId;

  // Autoguardado: mientras el usuario llena el formulario (antes de tocar
  // "Generar informe técnico"), el progreso se refleja en Dexie cada pocos
  // segundos - así una recarga, un cierre accidental o quedarse sin batería
  // no pierden lo ya diligenciado, las fotos ya tomadas ni las firmas ya
  // capturadas. No se crea el borrador hasta que haya algo real que guardar
  // (evita filas vacías por solo abrir la página). Corre con un intervalo
  // fijo, no atado a "qué cambió", precisamente para no depender de que el
  // usuario también haya tocado un campo de texto justo después de firmar.
  useEffect(() => {
    if (!draftLoaded || isEditMode) return;

    const saveDraft = async () => {
      const formState = formStateRef.current;
      const evidencePhotos = evidencePhotosRef.current;
      const selectedMaintenanceId = selectedMaintenanceIdRef.current;

      const form = formRef.current;
      const liveSignatures: Record<string, string> = {};
      if (form) {
        const liveFormData = new FormData(form);
        for (const key of SIGNATURE_FIELD_NAMES) {
          const value = liveFormData.get(key);
          if (value) liveSignatures[key] = String(value);
        }
      }
      // Solo la imagen dibujada cuenta como "contenido real" - Nombre/Cargo/
      // Fecha vienen con valores por defecto (la fecha de hoy) desde el
      // primer render de SignaturePad, así que por sí solos no deben bastar
      // para crear un borrador vacío con solo abrir la página.
      const hasSignatureContent = Boolean(liveSignatures.technicalSignatureImage || liveSignatures.clientSignatureImage);
      const hasContent = formState.clientName || formState.problemDescription || evidencePhotos.length > 0;
      if (!hasContent && !hasSignatureContent) return;

      const db = getOfflineDb(scopeKey);
      await db.operations.put({
        id: draftIdRef.current,
        type: "CREATE_TECHNICAL_REPORT",
        payload: {
          ...formState,
          ...liveSignatures,
          __maintenanceId: selectedMaintenanceId,
          __companyId: companyId,
          __evidence: JSON.stringify(evidencePhotos.map(({ clientId, title, type, url, pendingLocal }) => ({ clientId, title, type, url: pendingLocal ? "" : url, pendingLocal }))),
        },
        status: "DRAFT",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        summary: formState.clientName ? `Informe técnico - ${formState.clientName}` : "Informe técnico (borrador)",
      });
    };

    const interval = setInterval(() => void saveDraft(), 2000);
    return () => clearInterval(interval);
    // isEditMode no cambia durante la vida del componente (se deriva de un
    // prop fijo) - no hace falta que dispare este efecto de nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, scopeKey, companyId]);

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
            auto.push({ clientId: crypto.randomUUID(), title: autoTitle, url: result.maintenance.evidenceBeforeUrl, type: "BEFORE" });
          }
          if (result.maintenance.evidenceAfterUrl) {
            auto.push({ clientId: crypto.randomUUID(), title: autoTitle, url: result.maintenance.evidenceAfterUrl, type: "AFTER" });
          }
          return [...auto, ...manual].slice(0, MAX_EVIDENCE_ITEMS);
        });
      }
    }
  };

  const addEvidencePhoto = () => {
    // El tipo por defecto es "Evidencia": es el caso más genérico y no debe
    // obligar a la persona a pensar en Antes/Después antes de subir la foto.
    setEvidencePhotos((prev) =>
      prev.length >= MAX_EVIDENCE_ITEMS ? prev : [...prev, { clientId: crypto.randomUUID(), title: "", url: "", type: "EVIDENCE" }]
    );
  };

  const removeEvidencePhoto = async (index: number) => {
    const photo = evidencePhotos[index];
    if (photo?.pendingLocal) {
      const db = getOfflineDb(scopeKey);
      await db.files.where("fieldName").equals(photo.clientId).delete();
    }
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEvidencePhoto = (index: number, patch: Partial<EvidencePhoto>) => {
    setEvidencePhotos((prev) => prev.map((photo, i) => (i === index ? { ...photo, ...patch } : photo)));
  };

  const handleLocalFile = async (clientId: string, file: File) => {
    const db = getOfflineDb(scopeKey);
    // fieldName guarda temporalmente el clientId de la foto (estable mientras
    // se edita el formulario) - se renombra al índice final evidenceUrl_<n>
    // recién al confirmar "Generar informe técnico" offline, ver onSubmit.
    await db.files.put({
      id: clientId,
      operationId: draftIdRef.current,
      fieldName: clientId,
      blob: file,
      mimeType: file.type,
      fileName: file.name,
      createdAt: Date.now(),
    });
    const objectUrl = URL.createObjectURL(file);
    setEvidencePhotos((prev) => prev.map((photo) => (photo.clientId === clientId ? { ...photo, pendingLocal: true, url: objectUrl } : photo)));
  };

  const clearDraft = async () => {
    const db = getOfflineDb(scopeKey);
    await db.operations.delete(draftIdRef.current);
    await db.files.where("operationId").equals(draftIdRef.current).delete();
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
    // Solo las fotos que realmente tienen una imagen (subida o guardada
    // localmente) viajan - una fila agregada y luego dejada vacía no debe
    // generar un item de evidencia sin imagen.
    const photosToSubmit = evidencePhotos.filter((photo) => photo.url || photo.pendingLocal);
    formData.set("evidenceCount", String(photosToSubmit.length));
    photosToSubmit.forEach((photo, index) => {
      formData.set(`evidenceTitle_${index}`, photo.title);
      formData.set(`evidenceType_${index}`, photo.type);
      if (!photo.pendingLocal) formData.set(`evidenceUrl_${index}`, photo.url);
    });

    if (isEditMode) {
      // Corregir un informe requiere conexión: no tiene sentido encolar una
      // corrección sin conexión para un informe que el cliente ya pudo haber
      // recibido - a diferencia de crear uno nuevo, aquí se prefiere fallar
      // claro en vez de resolver un caso offline que no fue pedido.
      if (!isOnline) {
        setError("Para corregir un informe necesitas conexión a internet.");
        setIsLoading(false);
        return;
      }
      try {
        const result = await updateTechnicalReport(editReportId as string, formData);
        if (result.success) {
          setMessage(result.message || "Informe técnico corregido correctamente.");
        } else {
          setError(result.error || "No fue posible corregir el informe técnico.");
        }
      } catch {
        setError("No fue posible corregir el informe técnico. Verifica tu conexión e intenta de nuevo.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!isOnline) {
      try {
        const db = getOfflineDb(scopeKey);
        // Renombra cada Blob pendiente a su índice final evidenceUrl_<n> -
        // ver lib/offline/sync.ts, que sube cada archivo de la operación y
        // pone el resultado en el campo del payload con ese mismo nombre.
        for (let index = 0; index < photosToSubmit.length; index += 1) {
          const photo = photosToSubmit[index];
          if (photo.pendingLocal) {
            await db.files.where("fieldName").equals(photo.clientId).modify({ fieldName: `evidenceUrl_${index}` });
          }
        }
        // Cualquier Blob que haya quedado de una foto ELIMINADA antes de
        // enviar (nunca llegó a formar parte de photosToSubmit) se limpia -
        // si no, quedaría huérfano en Dexie sin ninguna operación PENDING que
        // lo reclame.
        const remainingClientIds = new Set(photosToSubmit.filter((p) => p.pendingLocal).map((p) => p.clientId));
        const allFiles = await db.files.where("operationId").equals(draftIdRef.current).toArray();
        for (const file of allFiles) {
          if (!file.fieldName.startsWith("evidenceUrl_") && !remainingClientIds.has(file.fieldName)) {
            await db.files.delete(file.id);
          }
        }

        const payload: Record<string, unknown> = { __companyId: companyId };
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) continue;
          payload[key] = value;
        }

        await db.operations.put({
          id: draftIdRef.current,
          type: "CREATE_TECHNICAL_REPORT",
          payload,
          status: "PENDING",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          attempts: 0,
          summary: `Informe técnico - ${formState.clientName || "sin cliente"}`,
        });

        const pendingPhotoCount = photosToSubmit.filter((p) => p.pendingLocal).length;
        setMessage(
          `Guardado sin conexión. ${pendingPhotoCount > 0 ? `${pendingPhotoCount} foto(s) y ` : ""}el informe se generarán automáticamente cuando vuelva Internet.`
        );
        draftIdRef.current = crypto.randomUUID();
        setFormState(emptyFormState);
        setEvidencePhotos([]);
        setSelectedMaintenanceId("");
        setSignatureRestore({});
        setFormResetCounter((n) => n + 1);
        formRef.current?.reset();
      } catch {
        setError("No se pudo guardar el informe sin conexión en este dispositivo.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const result = await generateTechnicalReport(formData);
      if (result.success) {
        setMessage(result.message || "Informe técnico generado correctamente.");
        await clearDraft();
        // Sin este reset, el autoguardado (corre cada 2s sin importar qué
        // disparó el render) vería el formulario todavía lleno con lo que se
        // acaba de generar y resucitaría un borrador fantasma con ese mismo
        // contenido bajo el id nuevo, segundos después de un envío exitoso.
        draftIdRef.current = crypto.randomUUID();
        setFormState(emptyFormState);
        setEvidencePhotos([]);
        setSelectedMaintenanceId("");
        setSignatureRestore({});
        setFormResetCounter((n) => n + 1);
        formRef.current?.reset();
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

  if (!draftLoaded) {
    return (
      <div className="flex items-center justify-center rounded-lg border p-12 text-sm text-muted-foreground">
        <Loader className="mr-2 h-4 w-4 animate-spin" /> Cargando...
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? "Corregir informe técnico" : "Nuevo informe técnico"}</CardTitle>
          <CardDescription>
            {isEditMode
              ? "Edita los datos necesarios y guarda la corrección: se reemplaza el mismo informe ya entregado."
              : "Completa el formulario y genera un PDF listo para entregar al cliente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editLoadError ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{editLoadError}</span>
            </div>
          ) : null}
          {draftRestoredNotice ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              <CheckCircle className="h-4 w-4" />
              <span>Se restauró un borrador guardado en este dispositivo.</span>
            </div>
          ) : null}
          {!isOnline && isEditMode ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <CloudOff className="h-4 w-4" />
              <span>Sin conexión: para corregir y guardar este informe necesitas conexión a internet.</span>
            </div>
          ) : null}
          {!isOnline && !isEditMode ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <CloudOff className="h-4 w-4" />
              <span>
                Sin conexión: puedes completar todo el informe (datos, fotos y firmas). Se guardará en este dispositivo
                y el PDF se generará automáticamente al volver Internet.
              </span>
            </div>
          ) : null}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
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
              <Label htmlFor="procedure">Procedimiento ejecutado</Label>
              <textarea id="procedure" name="procedure" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.procedure} onChange={(e) => setFormState((prev) => ({ ...prev, procedure: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sparePartsUsed">Repuestos utilizados</Label>
              <textarea id="sparePartsUsed" name="sparePartsUsed" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.sparePartsUsed} onChange={(e) => setFormState((prev) => ({ ...prev, sparePartsUsed: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observaciones</Label>
              <textarea id="observations" name="observations" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formState.observations} onChange={(e) => setFormState((prev) => ({ ...prev, observations: e.target.value }))} />
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
                <div key={photo.clientId} className="space-y-2 rounded-md border bg-background p-3">
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
                    <Button type="button" size="sm" variant="ghost" onClick={() => void removeEvidencePhoto(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <EvidencePicker
                    label={`Foto (${EVIDENCE_TYPE_LABELS[photo.type]})`}
                    companyId={companyId}
                    initialUrl={photo.url}
                    offline={!isOnline}
                    onUploaded={(url) => updateEvidencePhoto(index, { url, pendingLocal: false })}
                    onLocalFile={(file) => void handleLocalFile(photo.clientId, file)}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SignaturePad
                key={`technical-${formResetCounter}`}
                label="Firma de quien entrega"
                name="technicalSignature"
                defaultName={signatureRestore.technicalSignatureName || formState.technicianName}
                defaultRole={signatureRestore.technicalSignatureRole}
                defaultDate={signatureRestore.technicalSignatureDate}
                initialDataUrl={signatureRestore.technicalSignatureImage}
              />
              <SignaturePad
                key={`client-${formResetCounter}`}
                label="Firma de quien recibe"
                name="clientSignature"
                defaultName={signatureRestore.clientSignatureName || formState.clientContact}
                defaultRole={signatureRestore.clientSignatureRole}
                defaultDate={signatureRestore.clientSignatureDate}
                initialDataUrl={signatureRestore.clientSignatureImage}
              />
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {message ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {message}
                </span>
                {isEditMode ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => router.push("/informes")}>
                    Volver a informes
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" disabled={isLoading || (isEditMode && !isOnline)} className="w-full">
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : isEditMode ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" /> Guardar corrección
                </>
              ) : !isOnline ? (
                <>
                  <CloudOff className="mr-2 h-4 w-4" /> Guardar sin conexión
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" /> Generar informe técnico
                </>
              )}
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
          <p>• Las firmas se pueden dibujar a mano (mouse o dedo) o subir como imagen, y se incrustan en el PDF.</p>
          <p>• El PDF se guarda para descarga y se registra en el historial de informes.</p>
          <p>• Sin conexión, puedes completar todo (datos, fotos, firmas) y quedará &quot;Pendiente de generación&quot; hasta que vuelva Internet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
