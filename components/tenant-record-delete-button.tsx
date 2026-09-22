"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTenantRecord } from "@/lib/actions/tenant-records";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ModuleKey } from "@/lib/modules";
import { useConnectivity } from "@/lib/offline/connectivity";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDb } from "@/lib/offline/db";

type Props = {
  table: ModuleKey;
  recordId: string;
  recordLabel: string;
};

// Mismo conjunto de tablas que soportan CRUD offline en tenant-record-form.tsx.
const OFFLINE_DELETE_TABLES = new Set<ModuleKey>(["assets", "projects", "maintenance_records", "incidents"]);

export function TenantRecordDeleteButton({ table, recordId, recordLabel }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const { isOnline } = useConnectivity();
  const { scopeKey } = useOffline();

  useEffect(() => {
    if (!queuedOffline) return;
    const timeout = setTimeout(() => {
      setConfirmOpen(false);
      setQueuedOffline(false);
      router.refresh();
    }, 1200);
    return () => clearTimeout(timeout);
  }, [queuedOffline, router]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    if (!isOnline && OFFLINE_DELETE_TABLES.has(table)) {
      const db = getOfflineDb(scopeKey);
      await db.operations.add({
        id: crypto.randomUUID(),
        type: "CRUD",
        table,
        action: "DELETE",
        recordId,
        payload: {},
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        summary: `Eliminar: ${recordLabel}`
      });
      setDeleting(false);
      setQueuedOffline(true);
      return;
    }

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
        description={
          queuedOffline
            ? "Eliminación guardada sin conexión. Se aplicará cuando vuelva Internet."
            : !isOnline && OFFLINE_DELETE_TABLES.has(table)
              ? "Sin conexión: la eliminación se guardará y se aplicará cuando vuelva Internet."
              : (error ?? "Esta acción no se puede deshacer.")
        }
        busy={deleting || queuedOffline}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
          if (queuedOffline) {
            setQueuedOffline(false);
            router.refresh();
          }
        }}
      />
    </>
  );
}
