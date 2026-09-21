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
import { useConnectivity } from "@/lib/offline/connectivity";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDb, type QueueOperationType } from "@/lib/offline/db";

const initialState: TenantRecordActionState = {
  success: false
};

// Solo creación (no edición, no borrado) - ver reporte de la Fase 1 de modo
// offline: registrar información nueva en campo es el caso real reportado
// por el cliente; editar/eliminar offline abre preguntas de conflicto
// (¿qué pasa si alguien más ya cambió ese mismo registro?) que quedan fuera
// de este alcance a propósito.
const OFFLINE_CREATE_TABLE_TYPES: Partial<Record<ModuleKey, QueueOperationType>> = {
  maintenance_records: "CREATE_MAINTENANCE",
  incidents: "CREATE_INCIDENT",
  assets: "CREATE_ASSET"
};

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
  const offlineOperationType = OFFLINE_CREATE_TABLE_TYPES[table];

  useEffect(() => {
    if (!state.success) return;
    if (!isEdit) formRef.current?.reset();
    router.refresh();
    onSuccess?.();
  }, [router, state.success, isEdit, onSuccess]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    setOfflineMessage(null);

    // Editar sin conexión no está soportado todavía (ver manual): la Server
    // Action de todos modos fallaría con un error de red confuso, así que se
    // corta antes con un mensaje claro en vez de dejar que eso pase.
    if (isEdit && !isOnline) {
      event.preventDefault();
      setClientError("No se pueden guardar cambios sin conexión todavía. Intenta de nuevo cuando vuelva la señal.");
      return;
    }

    // Documentos requiere subir el archivo a Storage antes de poder crear el
    // registro (ver más abajo) - eso necesita conexión sí o sí, así que se
    // avisa de una vez en vez de dejar que el intento de subida falle solo.
    if (!isEdit && table === "asset_documents" && !isOnline) {
      event.preventDefault();
      setClientError("No se pueden cargar documentos sin conexión. Intenta de nuevo cuando vuelva la señal.");
      return;
    }

    if (!isEdit && offlineOperationType && !isOnline) {
      event.preventDefault();
      setClientError(null);
      const form = event.currentTarget;
      const formData = new FormData(form);

      const payload: Record<string, unknown> = { __redirectTo: redirectTo };
      for (const field of fields) {
        const raw = formData.get(field.name);
        if (raw !== null && raw !== "") payload[field.name] = String(raw);
      }
      const summaryField = fields[0]?.name;
      const summary = summaryField ? String(formData.get(summaryField) || "Registro sin título") : "Registro";

      const db = getOfflineDb(scopeKey);
      await db.operations.add({
        id: crypto.randomUUID(),
        type: offlineOperationType,
        payload,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        summary
      });

      setOfflineMessage("Guardado sin conexión. Se sincronizará automáticamente cuando vuelva Internet.");
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
                {field.options.map((option) => (
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
          {!isOnline && offlineOperationType ? <CloudOff className="h-4 w-4" /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {pending || uploading
            ? "Guardando..."
            : !isOnline && offlineOperationType
              ? "Guardar sin conexión"
              : isEdit
                ? "Guardar cambios"
                : "Crear"}
        </Button>
      </form>
    </div>
  );
}
