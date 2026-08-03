"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTenantRecord } from "@/lib/actions/tenant-records";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ModuleKey } from "@/lib/modules";

type Props = {
  table: ModuleKey;
  recordId: string;
  recordLabel: string;
};

export function TenantRecordDeleteButton({ table, recordId, recordLabel }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteTenantRecord(table, recordId);
    setDeleting(false);

    if (!result.success) {
      setError(result.error || "No se pudo eliminar el registro.");
      return;
    }

    setConfirmOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        Eliminar
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title={`Eliminar "${recordLabel}"`}
        description={error ?? "Esta acción no se puede deshacer."}
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
