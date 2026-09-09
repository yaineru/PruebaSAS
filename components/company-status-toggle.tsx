"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toggleCompanyStatus } from "@/lib/actions/super-admin";

export function CompanyStatusToggle({ companyId, status }: { companyId: string; status: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isActive = status === "ACTIVE";
  const nextStatus = isActive ? "SUSPENDED" : "ACTIVE";

  function apply() {
    startTransition(async () => {
      const result = await toggleCompanyStatus(companyId, nextStatus);
      if (!result.success) {
        setError(result.error ?? "No se pudo actualizar el estado.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={isActive ? "destructive" : "default"}
        onClick={() => setConfirmOpen(true)}
      >
        {isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {isActive ? "Suspender" : "Reactivar"}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title={isActive ? "Suspender empresa" : "Reactivar empresa"}
        description={
          error ??
          (isActive
            ? "Los usuarios de esta empresa perderán acceso inmediatamente hasta que se reactive."
            : "Los usuarios de esta empresa recuperarán acceso inmediatamente.")
        }
        confirmLabel={isActive ? "Suspender" : "Reactivar"}
        destructive={isActive}
        busy={pending}
        onConfirm={apply}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
