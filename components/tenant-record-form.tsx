"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Plus, Save } from "lucide-react";
import {
  createTenantRecord,
  updateTenantRecord,
  type TenantRecordActionState
} from "@/lib/actions/tenant-records";
import type { ModuleField, ModuleKey } from "@/lib/modules";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLiveQuery } from "dexie-react-hooks";
import { useConnectivity } from "@/lib/offline/connectivity";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDb } from "@/lib/offline/db";

// Mismo mapeo que FK_TABLE_BY_FIELD en lib/actions/tenant-records.ts: qué
// tabla referencia cada campo uuid. Se usa para completar los <select> con
// registros creados sin conexión (todavía no existen en Supabase, así que
// nunca aparecerían en las opciones que llegaron pre-cargadas del servidor).
const FK_TABLE_BY_FIELD: Record<string, ModuleKey> = {
  asset_id: "assets",
  project_id: "projects",
  maintenance_record_id: "maintenance_records"
};

const initialState: TenantRecordActionState = {
  success: false
};

// Tablas que soportan crear y editar sin conexión a través del motor CRUD
// genérico de la cola offline (lib/offline/sync.ts). "asset_documents" solo
// entra aquí para EDITAR metadata (sin archivo) - crear un documento nuevo
// sin conexión necesita guardar el archivo como Blob, ver más abajo.
const OFFLINE_CRUD_CREATE_TABLES = new Set<ModuleKey>(["assets", "projects", "maintenance_records", "incidents", "users"]);
const OFFLINE_CRUD_UPDATE_TABLES = new Set<ModuleKey>([
  "assets",
  "projects",
  "maintenance_records",
  "incidents",
  "users",
  "asset_documents"
]);
// Mismo conjunto que CLIENT_ID_TABLES en lib/actions/tenant-records.ts: estas
// tablas aceptan un id elegido por el dispositivo al crear, para que otro
// registro creado offline en la misma sesión (ej. un Mantenimiento de una
// Obra recién creada, también offline) pueda referenciarlo de inmediato sin
// esperar a que sincronice primero.
const CLIENT_ID_TABLES = new Set<ModuleKey>(["assets", "projects", "maintenance_records", "incidents", "users"]);

type TenantRecordFormProps = {
  fields: ModuleField[];
  table: ModuleKey;
  redirectTo: string;
  companyName: string;
  companyId: string;
  mode?: "create" | "edit";
  recordId?: string;
  record?: Record<string, string | number | null>;
  onSuccess?: () => void;
};

const maxDocumentBytes = 20 * 1024 * 1024;
const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const allowedDocumentExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp", "docx", "xlsx"]);

export function TenantRecordForm({
  fields,
  table,
  redirectTo,
  companyName,
  companyId,
  mode = "create",
  recordId,
  record,
  onSuccess
}: TenantRecordFormProps) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const [clientError, setClientError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(isEdit ? updateTenantRecord : createTenantRecord, initialState);
  const { isOnline } = useConnectivity();
  const { scopeKey } = useOffline();
  const offlineCreateSupported = !isEdit && OFFLINE_CRUD_CREATE_TABLES.has(table);
  const offlineUpdateSupported = isEdit && OFFLINE_CRUD_UPDATE_TABLES.has(table);
  const offlineDocumentSupported = !isEdit && table === "asset_documents";
  const offlineSupported = offlineCreateSupported || offlineUpdateSupported || offlineDocumentSupported;

  // Un registro creado sin conexión (ej. una Obra) todavía no existe en
  // Supabase, así que nunca aparecería en las opciones de un <select> que se
  // llenaron desde el servidor al cargar la página - sin esto, sería
  // imposible crear offline un Mantenimiento de esa misma Obra en la misma
  // sesión, aunque el motor de sincronización sí sabría resolver la
  // dependencia (ver CLIENT_ID_TABLES en lib/actions/tenant-records.ts).
  const pendingByTable = useLiveQuery(async () => {
    const relevantFields = fields.filter((field) => field.type === "uuid" && FK_TABLE_BY_FIELD[field.name]);
    if (relevantFields.length === 0) return {};
    const db = getOfflineDb(scopeKey);
    const all = await db.operations
      .where("status")
      .anyOf(["PENDING", "FAILED"])
      .toArray();
    const result: Record<string, Array<{ value: string; label: string }>> = {};
    for (const field of relevantFields) {
      const relatedTable = FK_TABLE_BY_FIELD[field.name];
      result[field.name] = all
        .filter((op) => op.type === "CRUD" && op.table === relatedTable && op.action === "CREATE" && op.recordId)
        .map((op) => ({ value: op.recordId!, label: `${op.summary} (pendiente de sincronizar)` }));
    }
    return result;
  }, [scopeKey, fields]);

  function optionsForField(field: ModuleField): ModuleField["options"] {
    const pending = pendingByTable?.[field.name];
    if (!pending || pending.length === 0) return field.options;
    return [...(field.options ?? []), ...pending];
  }

  useEffect(() => {
    if (!state.success) return;
    if (!isEdit) formRef.current?.reset();
    router.refresh();
    onSuccess?.();
  }, [router, state.success, isEdit, onSuccess]);

  function summaryFromFormData(formData: FormData): string {
    const summaryField = fields[0]?.name;
    return summaryField ? String(formData.get(summaryField) || "Registro sin título") : "Registro";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    setOfflineMessage(null);

    if (!isOnline && isEdit && offlineUpdateSupported && recordId) {
      event.preventDefault();
      setClientError(null);
      const form = event.currentTarget;
      const formData = new FormData(form);

      const payload: Record<string, unknown> = { __redirectTo: redirectTo };
      for (const field of fields) {
        const raw = formData.get(field.name);
        if (raw !== null && raw !== "") payload[field.name] = String(raw);
      }

      const db = getOfflineDb(scopeKey);
      await db.operations.add({
        id: crypto.randomUUID(),
        type: "CRUD",
        table,
        action: "UPDATE",
        recordId,
        payload,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        summary: summaryFromFormData(formData)
      });

      setOfflineMessage("Cambios guardados sin conexión. Se sincronizarán automáticamente cuando vuelva Internet.");
      onSuccess?.();
      return;
    }

    // Editar un tipo que sí soporta offline-create pero no llegó con
    // recordId (no debería pasar en la práctica) o un módulo fuera de
    // OFFLINE_CRUD_UPDATE_TABLES: se avisa en vez de dejar que la Server
    // Action falle con un error de red confuso.
    if (isEdit && !isOnline && !offlineUpdateSupported) {
      event.preventDefault();
      setClientError("No se pueden guardar cambios sin conexión todavía. Intenta de nuevo cuando vuelva la señal.");
      return;
    }

    if (!isEdit && offlineCreateSupported && !isOnline) {
      event.preventDefault();
      setClientError(null);
      const form = event.currentTarget;
      const formData = new FormData(form);

      const payload: Record<string, unknown> = { __redirectTo: redirectTo };
      for (const field of fields) {
        const raw = formData.get(field.name);
        if (raw !== null && raw !== "") payload[field.name] = String(raw);
      }

      const generatedId = CLIENT_ID_TABLES.has(table) ? crypto.randomUUID() : undefined;

      const db = getOfflineDb(scopeKey);
      await db.operations.add({
        id: crypto.randomUUID(),
        type: "CRUD",
        table,
        action: "CREATE",
        recordId: generatedId,
        payload,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        summary: summaryFromFormData(formData)
      });

      setOfflineMessage("Guardado sin conexión. Se sincronizará automáticamente cuando vuelva Internet.");
      form.reset();
      return;
    }

    if (!isEdit && offlineDocumentSupported && !isOnline) {
      event.preventDefault();
      setClientError(null);
      const form = event.currentTarget;
      const file = fileRef.current?.files?.[0];

      if (!file) {
        setClientError("Selecciona un archivo para crear el documento.");
        return;
      }

      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowedDocumentTypes.has(file.type) || !allowedDocumentExtensions.has(extension)) {
        setClientError("El tipo de archivo no está permitido.");
        return;
      }
      if (file.size > maxDocumentBytes) {
        setClientError("El archivo supera el tamaño máximo de 20 MB.");
        return;
      }

      const formData = new FormData(form);
      const payload: Record<string, unknown> = { __redirectTo: redirectTo, __companyId: companyId };
      for (const field of fields) {
        const raw = formData.get(field.name);
        if (raw !== null && raw !== "") payload[field.name] = String(raw);
      }

      const operationId = crypto.randomUUID();
      const db = getOfflineDb(scopeKey);
      await db.files.add({
        id: crypto.randomUUID(),
        operationId,
        fieldName: "document_file",
        blob: file,
        mimeType: file.type,
        fileName: file.name,
        createdAt: Date.now()
      });
      await db.operations.add({
        id: operationId,
        type: "CREATE_DOCUMENT",
        payload,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        summary: summaryFromFormData(formData)
      });

      setOfflineMessage(
        "Documento guardado sin conexión. El archivo se subirá automáticamente cuando vuelva Internet."
      );
      form.reset();
      return;
    }

    if (table !== "asset_documents" || isEdit) return;

    event.preventDefault();
    setClientError(null);
    const form = event.currentTarget;
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setClientError("Selecciona un archivo para crear el documento.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedDocumentTypes.has(file.type) || !allowedDocumentExtensions.has(extension)) {
      setClientError("El tipo de archivo no está permitido.");
      return;
    }

    if (file.size > maxDocumentBytes) {
      setClientError("El archivo supera el tamaño máximo de 20 MB.");
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${companyId}/documents/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("company-files").upload(path, file, {
        contentType: file.type,
        upsert: false
      });

      if (error) {
        console.warn("Document client upload failed", error.message);
        setClientError("No se pudo subir el archivo. Verifica el formato e intenta de nuevo.");
        return;
      }

      const formData = new FormData(form);
      formData.set("file_name", file.name);
      formData.set("file_path", path);
      formData.set("mime_type", file.type);
      formData.set("file_size", String(file.size));

      startTransition(() => {
        formAction(formData);
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {isEdit ? `Los cambios se guardarán en ${companyName}.` : `Se guardará automáticamente en ${companyName}.`}
      </p>

      {clientError || state.error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {clientError ?? state.error}
        </div>
      ) : null}

      {offlineMessage ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{offlineMessage}</span>
        </div>
      ) : null}

      {state.success && state.message ? (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {state.message}
        </div>
      ) : null}

      <form ref={formRef} action={formAction} onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        {isEdit ? <input type="hidden" name="recordId" value={recordId} /> : null}
        {table === "asset_documents" && !isEdit ? (
          <div className="space-y-2">
            <Label htmlFor="file">Archivo</Label>
            <Input
              id="file"
              ref={fileRef}
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
            <p className="text-xs text-muted-foreground">PDF, imágenes, DOCX o XLSX. Máximo 20 MB.</p>
          </div>
        ) : null}
        {fields.map((field) => (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={field.name}>
              {field.label}
              {!field.required ? <span className="ml-1 font-normal text-muted-foreground">(opcional)</span> : null}
            </Label>
            {field.options ? (
              <select
                id={field.name}
                name={field.name}
                required={field.required}
                defaultValue={record?.[field.name] != null ? String(record[field.name]) : ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Seleccionar</option>
                {optionsForField(field)!.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                name={field.name}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                required={field.required}
                defaultValue={record?.[field.name] != null ? String(record[field.name]) : undefined}
              />
            )}
          </div>
        ))}
        <Button className="w-full" disabled={pending || uploading}>
          {!isOnline && offlineSupported ? <CloudOff className="h-4 w-4" /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {pending || uploading
            ? "Guardando..."
            : !isOnline && offlineSupported
              ? "Guardar sin conexión"
              : isEdit
                ? "Guardar cambios"
                : "Crear"}
        </Button>
      </form>
    </div>
  );
}
