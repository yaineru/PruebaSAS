"use client";

import { useState } from "react";
import { Download, Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type DocumentActionsProps = {
  id: string;
  filePath: string | null;
  fileName: string | null;
};

export function DocumentActions({ id, filePath, fileName }: DocumentActionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || !filePath;

  async function openSignedUrl(download = false) {
    if (!filePath) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("company-files")
        .createSignedUrl(filePath, 60, download ? { download: fileName ?? true } : undefined);

      if (error || !data?.signedUrl) {
        console.warn("Signed URL failed", error?.message);
        alert("No se pudo abrir el documento.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument() {
    if (!filePath) return;

    setBusy(true);
    setError(null);
    try {
      const storageResult = await supabase.storage.from("company-files").remove([filePath]);
      if (storageResult.error) {
        console.warn("Document storage delete failed", storageResult.error.message);
        setError("No se pudo eliminar el archivo.");
        return;
      }

      const dbResult = await supabase.from("asset_documents").delete().eq("id", id);
      if (dbResult.error) {
        console.warn("Document database delete failed", dbResult.error.message);
        setError("No se pudo eliminar el registro del documento.");
        return;
      }

      setConfirmOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void openSignedUrl(false)}>
        <Eye className="h-4 w-4" />
        Ver
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void openSignedUrl(true)}>
        <Download className="h-4 w-4" />
        Descargar
      </Button>
      <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={() => setConfirmOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Eliminar
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar documento"
        description={error ?? "Esta acción no se puede deshacer."}
        busy={busy}
        onConfirm={() => void removeDocument()}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
        }}
      />
    </div>
  );
}
