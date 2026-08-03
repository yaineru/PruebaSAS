"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
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

const initialState: TenantRecordActionState = {
  success: false
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
  const [state, formAction, pending] = useActionState(isEdit ? updateTenantRecord : createTenantRecord, initialState);

  useEffect(() => {
    if (!state.success) return;
    if (!isEdit) formRef.current?.reset();
    router.refresh();
    onSuccess?.();
  }, [router, state.success, isEdit, onSuccess]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
            <Label htmlFor={field.name}>{field.label}</Label>
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
          {isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {pending || uploading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear"}
        </Button>
      </form>
    </div>
  );
}
