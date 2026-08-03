"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantRecordForm } from "@/components/tenant-record-form";
import type { ModuleField, ModuleKey } from "@/lib/modules";

type Props = {
  fields: ModuleField[];
  table: ModuleKey;
  redirectTo: string;
  companyName: string;
  companyId: string;
  recordId: string;
  record: Record<string, string | number | null>;
  recordLabel: string;
};

export function TenantRecordEditButton({
  fields,
  table,
  redirectTo,
  companyName,
  companyId,
  recordId,
  record,
  recordLabel
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Editar
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle>Editar {recordLabel}</CardTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <TenantRecordForm
                fields={fields}
                table={table}
                redirectTo={redirectTo}
                companyName={companyName}
                companyId={companyId}
                mode="edit"
                recordId={recordId}
                record={record}
                onSuccess={() => setOpen(false)}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
