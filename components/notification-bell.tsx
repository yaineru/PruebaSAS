"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NotificationRow = {
  id: string;
  title: string;
  message: string | null;
  event_type: string;
  status: string;
  created_at: string;
};

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    INCIDENT_CREATED: "Nueva novedad",
    MAINTENANCE_CREATED: "Mantenimiento",
    DOCUMENT_EXPIRING: "Documento por vencer",
    DOCUMENT_EXPIRED: "Documento vencido",
    USER_CREATED: "Nuevo usuario",
    ASSET_ASSIGNED: "Asignación",
    PROJECT_CREATED: "Nueva obra",
    ASSET_MAINTENANCE_DUE: "Mantenimiento próximo",
    INSURANCE_EXPIRING: "Póliza por vencer",
    TECHNICAL_CERTIFICATE_EXPIRING: "Certificado por vencer",
    SYSTEM: "Sistema"
  };

  return labels[value] ?? "Notificación";
}

export function NotificationBell({ companyId }: { companyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [{ count: unread, error: countError }, { data, error: listError }] = await Promise.all([
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("status", "UNREAD"),
          supabase
            .from("notifications")
            .select("id,title,message,event_type,status,created_at")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(8)
        ]);

        if (countError || listError) {
          console.warn("Notification load failed", countError?.message ?? listError?.message);
          return;
        }

        setCount(unread ?? 0);
        setItems(data ?? []);
      } catch (error) {
        console.warn("Notification load failed", error);
      }
    }

    void load();
    const channel = supabase.channel(`centro-notificaciones:${companyId}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `company_id=eq.${companyId}` },
      () => void load()
    );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") console.warn("Notification realtime channel error");
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, supabase]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Abrir notificaciones"
        aria-expanded={open}
        className="relative"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 py-0 text-[10px]">
            {count > 99 ? "99+" : count}
          </Badge>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-md border bg-card p-3 text-card-foreground shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div>
              <p className="font-semibold">Notificaciones</p>
              <p className="text-xs text-muted-foreground">{count} sin leer</p>
            </div>
            <Badge variant="secondary">Tiempo real</Badge>
          </div>

          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay notificaciones recientes.
              </p>
            ) : (
              items.map((item) => (
                <div className="rounded-md border p-3" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.message ?? eventLabel(item.event_type)}</p>
                    </div>
                    {item.status === "UNREAD" ? <Badge>Nuevo</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
