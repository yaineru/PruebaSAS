"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Trash2, CheckCircle2 } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  message: string | null;
  event_type: string;
  status: "UNREAD" | "READ" | "ARCHIVED";
  created_at: string;
  entity_table?: string;
  entity_id?: string;
};

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  INCIDENT_CREATED: { label: "Nueva novedad", color: "bg-red-100 text-red-800" },
  ASSET_CREATED: { label: "Nuevo activo", color: "bg-blue-100 text-blue-800" },
  MAINTENANCE_CREATED: { label: "Mantenimiento", color: "bg-blue-100 text-blue-800" },
  DOCUMENT_EXPIRING: { label: "Documento por vencer", color: "bg-yellow-100 text-yellow-800" },
  DOCUMENT_EXPIRED: { label: "Documento vencido", color: "bg-red-100 text-red-800" },
  USER_CREATED: { label: "Nuevo usuario", color: "bg-green-100 text-green-800" },
  ASSET_ASSIGNED: { label: "Asignación", color: "bg-purple-100 text-purple-800" },
  PROJECT_CREATED: { label: "Nueva obra", color: "bg-blue-100 text-blue-800" },
  ASSET_MAINTENANCE_DUE: { label: "Mantenimiento próximo", color: "bg-yellow-100 text-yellow-800" },
  INSURANCE_EXPIRING: { label: "Póliza por vencer", color: "bg-orange-100 text-orange-800" },
  TECHNICAL_CERTIFICATE_EXPIRING: { label: "Certificado por vencer", color: "bg-orange-100 text-orange-800" },
  REPORT_GENERATED: { label: "Informe generado", color: "bg-green-100 text-green-800" },
  SYSTEM: { label: "Sistema", color: "bg-gray-100 text-gray-800" }
};

type Props = {
  companyId: string;
  initialNotifications: Notification[];
};

export function NotificationCenter({ companyId, initialNotifications }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");

  useEffect(() => {
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`notifications-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n))
            );
          } else if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, supabase]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return n.status === "UNREAD";
    if (filter === "archived") return n.status === "ARCHIVED";
    return true;
  });

  const unreadCount = notifications.filter((n) => n.status === "UNREAD").length;

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ status: "READ" })
      .eq("id", id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ" as const } : n))
      );
    }
  };

  const markAsArchived = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ status: "ARCHIVED" })
      .eq("id", id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "ARCHIVED" as const } : n))
      );
    }
  };

  const deleteNotification = async (id: string) => {
    if (!confirm("¿Eliminar esta notificación?")) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter((n) => n.status === "UNREAD")
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ status: "READ" })
      .in("id", unreadIds);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.includes(n.id) ? { ...n, status: "READ" as const } : n))
      );
    }
  };

  const getEventInfo = (eventType: string) => {
    return EVENT_LABELS[eventType] || { label: eventType, color: "bg-gray-100 text-gray-800" };
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{notifications.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Total de notificaciones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{unreadCount}</div>
              <p className="text-sm text-muted-foreground mt-1">Sin leer</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              {unreadCount > 0 && (
                <Button onClick={markAllAsRead} variant="outline" size="sm">
                  Marcar todo como leído
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Centro de Notificaciones</CardTitle>
              <CardDescription>Gestiona tus notificaciones en tiempo real</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                Todas ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread">
                Sin leer ({unreadCount})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archivadas
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-6 space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {filter === "all"
                      ? "No hay notificaciones"
                      : filter === "unread"
                        ? "No hay notificaciones sin leer"
                        : "No hay notificaciones archivadas"}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const eventInfo = getEventInfo(notification.event_type);
                  return (
                    <Card
                      key={notification.id}
                      className={notification.status === "UNREAD" ? "border-blue-200 bg-blue-50" : ""}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className={eventInfo.color}>{eventInfo.label}</Badge>
                              {notification.status === "UNREAD" && (
                                <Badge className="bg-blue-100 text-blue-800">Nuevo</Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-sm">{notification.title}</h3>
                            {notification.message && (
                              <p className="text-sm text-muted-foreground">{notification.message}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {notification.status === "UNREAD" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => markAsRead(notification.id)}
                                title="Marcar como leído"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {notification.status !== "ARCHIVED" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => markAsArchived(notification.id)}
                                title="Archivar"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteNotification(notification.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
