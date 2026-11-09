"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  FileText,
  History,
  Plus,
  Siren,
  Trash2,
  Wrench,
  X
} from "lucide-react";
import { createAssetHistoryEntry, deleteAssetHistoryEntry, type AssetHistoryActionState } from "@/lib/actions/asset-history";
import { ENUM_OPTIONS } from "@/lib/enums";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Un solo timeline para "qué se le ha hecho a este equipo". Antes la ficha
// solo mostraba `maintenance_records`, así que el trabajo real quedaba
// repartido en cuatro sitios sin relación visible entre sí: el mantenimiento
// formal en su módulo, la falla en Novedades, el certificado en Documentos y
// el tornillo que se cambió ayer en ningún lado. Cada entrada conserva su
// origen (y el enlace a su módulo) en vez de aplanarse en un texto genérico.
export type AssetTimelineSource = "HISTORY" | "MAINTENANCE" | "INCIDENT" | "DOCUMENT";

export type AssetTimelineItem = {
  id: string;
  source: AssetTimelineSource;
  /** Fecha del hecho ("YYYY-MM-DD" o ISO completo) - el orden lo arma el servidor. */
  date: string | null;
  title: string;
  typeLabel: string | null;
  statusLabel: string | null;
  description: string | null;
  person: string | null;
  cost: number | null;
  hourMeter: number | null;
  projectName: string | null;
  href: string | null;
};

const SOURCE_META: Record<
  AssetTimelineSource,
  { label: string; plural: string; icon: typeof Wrench; accent: string }
> = {
  HISTORY: { label: "Intervención", plural: "Intervenciones", icon: Wrench, accent: "bg-primary" },
  MAINTENANCE: { label: "Mantenimiento", plural: "Mantenimientos", icon: CalendarCheck, accent: "bg-emerald-500" },
  INCIDENT: { label: "Novedad", plural: "Novedades", icon: Siren, accent: "bg-amber-500" },
  DOCUMENT: { label: "Documento", plural: "Documentos", icon: FileText, accent: "bg-sky-500" }
};

const FILTERS: Array<{ value: "ALL" | AssetTimelineSource; label: string }> = [
  { value: "ALL", label: "Todo" },
  { value: "HISTORY", label: SOURCE_META.HISTORY.plural },
  { value: "MAINTENANCE", label: SOURCE_META.MAINTENANCE.plural },
  { value: "INCIDENT", label: SOURCE_META.INCIDENT.plural },
  { value: "DOCUMENT", label: SOURCE_META.DOCUMENT.plural }
];

const initialState: AssetHistoryActionState = { success: false };

type Props = {
  assetId: string;
  assetName: string;
  items: AssetTimelineItem[];
  canAddEntry: boolean;
  canDeleteEntry: boolean;
};

export function AssetHistoryTimeline({ assetId, assetName, items, canAddEntry, canDeleteEntry }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [filter, setFilter] = useState<"ALL" | AssetTimelineSource>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAssetHistoryEntry, initialState);
  const [pendingDelete, setPendingDelete] = useState<AssetTimelineItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    setFormOpen(false);
    router.refresh();
  }, [state.success, router]);

  const counts = useMemo(() => {
    const result = new Map<string, number>([["ALL", items.length]]);
    for (const item of items) {
      result.set(item.source, (result.get(item.source) ?? 0) + 1);
    }
    return result;
  }, [items]);

  const visibleItems = useMemo(
    () => (filter === "ALL" ? items : items.filter((item) => item.source === filter)),
    [items, filter]
  );

  const today = new Date().toISOString().slice(0, 10);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAssetHistoryEntry(pendingDelete.id, assetId);
    setDeleting(false);
    if (!result.success) {
      setDeleteError(result.error ?? "No se pudo eliminar la entrada.");
      return;
    }
    setPendingDelete(null);
    router.refresh();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // El historial no tiene soporte offline todavía (a diferencia de
    // Equipos/Mantenimientos, que pasan por la cola de lib/offline/sync.ts):
    // se avisa en vez de dejar que la Server Action falle con un error de red
    // confuso y el usuario crea que se guardó.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      event.preventDefault();
      setOfflineWarning(
        "Sin conexión: esta entrada todavía no se puede guardar. Vuelve a intentarlo cuando regrese la señal."
      );
      return;
    }
    setOfflineWarning(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((option) => {
            const count = counts.get(option.value) ?? 0;
            const active = filter === option.value;
            return (
              <button
                type="button"
                key={option.value}
                onClick={() => setFilter(option.value)}
                aria-pressed={active}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                {option.label} ({count})
              </button>
            );
          })}
        </div>
        {canAddEntry ? (
          <Button
            type="button"
            size="sm"
            variant={formOpen ? "outline" : "default"}
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setFormOpen((open) => !open)}
          >
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? "Cancelar" : "Registrar intervención"}
          </Button>
        ) : null}
      </div>

      {canAddEntry && formOpen ? (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={onSubmit}
          className="space-y-4 rounded-md border bg-muted/40 p-4"
        >
          <input type="hidden" name="assetId" value={assetId} />
          <p className="text-sm text-muted-foreground">
            Anota lo que se le hizo a <span className="font-medium text-foreground">{assetName}</span>: un cambio de
            pieza, una revisión, un traslado o una observación. Para un mantenimiento planificado con estado y costos,
            usa el módulo de Mantenimientos.
          </p>

          {state.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}

          {offlineWarning ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {offlineWarning}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="history-title">Qué se hizo</Label>
            <Input
              id="history-title"
              name="title"
              required
              maxLength={200}
              placeholder="Se cambió el tornillo de anclaje del malacate 1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="history-event-type">Tipo</Label>
              <select
                id="history-event-type"
                name="event_type"
                defaultValue="INTERVENTION"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ENUM_OPTIONS.assetHistoryEventType.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-performed-at">Fecha</Label>
              <Input id="history-performed-at" name="performed_at" type="date" defaultValue={today} max={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-person">
                Quién lo hizo <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="history-person" name="performed_by_name" maxLength={120} placeholder="Carlos Ruiz" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-hour-meter">
                Horómetro <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="history-hour-meter" name="hour_meter" type="number" min={0} step="0.01" placeholder="1250" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-cost">
                Costo <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="history-cost" name="cost" type="number" min={0} step="0.01" placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="history-description">
              Detalle <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <textarea
              id="history-description"
              name="description"
              rows={3}
              maxLength={2000}
              placeholder="Pieza instalada, referencia, observaciones del operario..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Button className="w-full sm:w-auto" disabled={pending}>
            <Plus className="h-4 w-4" />
            {pending ? "Guardando..." : "Agregar al historial"}
          </Button>
        </form>
      ) : null}

      {state.success && state.message && !formOpen ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {state.message}
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <History className="mx-auto mb-2 h-5 w-5" />
          {items.length === 0
            ? "Todavía no hay historial para este equipo. Registra la primera intervención o crea un mantenimiento."
            : "No hay registros de ese tipo para este equipo."}
        </div>
      ) : (
        <ol className="space-y-3">
          {visibleItems.map((item) => {
            const meta = SOURCE_META[item.source];
            const Icon = meta.icon;
            return (
              <li className="relative border-l pl-4 sm:pl-5" key={`${item.source}-${item.id}`}>
                <span
                  className={`absolute -left-[7px] top-4 h-3.5 w-3.5 rounded-full ring-4 ring-background ${meta.accent}`}
                  aria-hidden
                />
                <div className="rounded-md border bg-card p-3 sm:p-4">
                  {/* Siempre en fila, también en móvil: apilado, "Ver" caía
                      suelto bajo la fecha y se leía como parte del texto de la
                      entrada en vez de como su acción. Las acciones son
                      estrechas (un enlace y un icono), así que caben arriba a
                      la derecha incluso a 375px, y el bloque de título lleva
                      min-w-0 para que el texto largo se parta en vez de
                      empujarlas fuera. */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                        {item.typeLabel ? <Badge variant="secondary">{item.typeLabel}</Badge> : null}
                        {item.statusLabel ? <Badge variant="secondary">{item.statusLabel}</Badge> : null}
                      </div>
                      <p className="mt-2 break-words font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(item.date)}
                        {item.projectName ? ` · ${item.projectName}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-primary hover:bg-muted"
                        >
                          Ver
                        </Link>
                      ) : null}
                      {canDeleteEntry && item.source === "HISTORY" ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Eliminar entrada del historial"
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete(item);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {item.description ? (
                    <p className="mt-3 whitespace-pre-line break-words text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}

                  {item.person || item.hourMeter !== null || (item.cost !== null && item.cost > 0) ? (
                    <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                      {item.person ? (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Responsable:</dt>
                          <dd className="min-w-0 break-words">{item.person}</dd>
                        </div>
                      ) : null}
                      {item.hourMeter !== null ? (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Horómetro:</dt>
                          <dd>{item.hourMeter.toLocaleString("es-CO")}</dd>
                        </div>
                      ) : null}
                      {item.cost !== null && item.cost > 0 ? (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Costo:</dt>
                          <dd>{formatCurrency(item.cost)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar entrada del historial"
        description={
          deleteError ??
          `Se eliminará "${pendingDelete?.title ?? ""}" del historial de este equipo. Esta acción no se puede deshacer.`
        }
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
