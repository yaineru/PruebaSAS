"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { retryEmailLogEntry } from "@/lib/actions/email-settings";
import { formatDate } from "@/lib/utils";

type LogRow = {
  id: string;
  to_email: string;
  subject: string;
  template_key: string;
  provider: string;
  status: string;
  attempts: number;
  error_message: string | null;
  smtp_server: string | null;
  sent_at: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  SENT: "default",
  PENDING: "secondary",
  RETRYING: "warning",
  FAILED: "destructive",
  CANCELLED: "secondary"
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "Enviado",
  PENDING: "Pendiente",
  RETRYING: "Reintentando",
  FAILED: "Fallido",
  CANCELLED: "Cancelado"
};

export function EmailLogTable({ rows }: { rows: LogRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aún no se ha enviado ningún correo.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Destinatario</TableHead>
            <TableHead>Asunto</TableHead>
            <TableHead>Plantilla</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Intentos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDate(row.created_at)}</TableCell>
              <TableCell className="font-medium">{row.to_email}</TableCell>
              <TableCell className="max-w-[220px] truncate" title={row.subject}>{row.subject}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.template_key}</TableCell>
              <TableCell className="text-xs">{row.smtp_server || row.provider}</TableCell>
              <TableCell>{row.attempts}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"} title={row.error_message ?? undefined}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              </TableCell>
              <TableCell>
                {(row.status === "FAILED" || row.status === "RETRYING") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await retryEmailLogEntry(row.id);
                        router.refresh();
                      })
                    }
                  >
                    Reintentar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
