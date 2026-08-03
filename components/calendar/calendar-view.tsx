'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityCard } from '@/components/calendar/activity-card';
import { ActivityFormDialog } from '@/components/calendar/activity-form-dialog';
import { ActivityTypeManager } from '@/components/calendar/activity-type-manager';
import { listActivitiesForRange, rescheduleActivity } from '@/lib/actions/activities';
import type { Activity, ActivityType } from '@/lib/activities/activity-schema';
import {
  HOUR_RANGE,
  buildMonthGrid,
  buildWeekDays,
  formatDayLabel,
  formatHourLabel,
  formatMonthLabel,
  formatShortDay,
  getVisibleRange,
  isSameDay,
  isSameMonth,
  navigateAnchor,
  type CalendarViewMode,
} from '@/lib/activities/date-utils';

type CompanyUser = { id: string; full_name: string };

type Props = {
  companyId: string;
  initialActivities: Activity[];
  activityTypes: ActivityType[];
  companyUsers: CompanyUser[];
};

function DroppableSlot({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'bg-primary/10' : ''}`}>
      {children}
    </div>
  );
}

export function CalendarView({ companyId, initialActivities, activityTypes, companyUsers }: Props) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>(undefined);
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);

  // Vercel's serverless functions run in UTC while a Colombian user's browser
  // is UTC-5, so from 7pm to midnight local time the server and the client
  // disagree about which calendar day is "today". Rendering that mismatch
  // straight into text (the "Hoy tienes N actividades" summary below) is a
  // React hydration error in production (#418) that never showed up in local
  // dev, where both server and browser share the same clock. Gating it on
  // `mounted` keeps the server-rendered HTML and the client's first render
  // identical, then fills in the real count from the client's own clock.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { start, end } = useMemo(() => getVisibleRange(anchor, viewMode), [anchor, viewMode]);

  // Extracted so create/edit/delete can force a refetch directly - relying
  // only on router.refresh() here doesn't work: `activities` is snapshotted
  // into useState on mount, so a fresh `initialActivities` prop from the
  // parent Server Component re-rendering never gets copied back in without
  // this being called explicitly after a mutation.
  const refetchActivities = useCallback(() => {
    startTransition(async () => {
      const rangeStart = new Date(start);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(end);
      rangeEnd.setHours(23, 59, 59, 999);
      const result = await listActivitiesForRange(companyId, rangeStart.toISOString(), rangeEnd.toISOString());
      setActivities(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, start.getTime(), end.getTime()]);

  useEffect(() => {
    refetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, start.getTime(), end.getTime()]);

  const openCreate = (date?: Date) => {
    setEditingActivity(null);
    setDefaultStart(date);
    setDialogOpen(true);
  };

  const openEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setDefaultStart(undefined);
    setDialogOpen(true);
  };

  const activitiesForDay = (day: Date) => activities.filter((a) => isSameDay(new Date(a.startAt), day));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activity = active.data.current?.activity as Activity | undefined;
    if (!activity) return;

    const [, dateStr, hourStr] = String(over.id).split(':');
    if (!dateStr) return;

    const originalStart = new Date(activity.startAt);
    const originalEnd = new Date(activity.endAt);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    const [year, month, day] = dateStr.split('-').map(Number);
    const newStart = new Date(originalStart);
    newStart.setFullYear(year, month - 1, day);
    if (hourStr && hourStr !== 'allday') {
      newStart.setHours(Number(hourStr), 0, 0, 0);
    }
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Optimistic UI update, then persist.
    setActivities((prev) =>
      prev.map((a) => (a.id === activity.id ? { ...a, startAt: newStart.toISOString(), endAt: newEnd.toISOString() } : a))
    );

    startTransition(async () => {
      const result = await rescheduleActivity(activity.id, newStart.toISOString(), newEnd.toISOString());
      if (!result.success) {
        setActivities((prev) => prev.map((a) => (a.id === activity.id ? activity : a)));
      }
    });
  };

  // date-fns' Spanish locale correctly returns lowercase ("agosto de 2026",
  // "miércoles 5 de agosto" - Spanish doesn't capitalize months/weekdays).
  // Capitalizing only the leading letter (not Tailwind's `capitalize`, which
  // title-cases every word and wrongly turns "de"/"del" into "De"/"Del").
  const rawHeaderLabel =
    viewMode === 'month'
      ? formatMonthLabel(anchor)
      : viewMode === 'week'
        ? `Semana del ${formatShortDay(getVisibleRange(anchor, 'week').start)}`
        : formatDayLabel(anchor);
  const headerLabel = rawHeaderLabel.charAt(0).toUpperCase() + rawHeaderLabel.slice(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor((prev) => navigateAnchor(prev, viewMode, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor((prev) => navigateAnchor(prev, viewMode, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold">{headerLabel}</h2>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setTypeManagerOpen(true)}>
            Tipos
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Nueva actividad
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {viewMode === 'month' && (
          <MonthGrid anchor={anchor} activities={activities} onDayClick={openCreate} onActivityClick={openEdit} />
        )}
        {(viewMode === 'week' || viewMode === 'day') && (
          <TimeGrid
            days={viewMode === 'week' ? buildWeekDays(anchor) : [anchor]}
            activities={activities}
            onSlotClick={openCreate}
            onActivityClick={openEdit}
          />
        )}
      </DndContext>

      <ActivityFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onMutated={refetchActivities}
        activity={editingActivity}
        activityTypes={activityTypes}
        companyUsers={companyUsers}
        defaultStart={defaultStart}
      />

      <ActivityTypeManager
        open={typeManagerOpen}
        onClose={() => setTypeManagerOpen(false)}
        activityTypes={activityTypes}
      />

      <p className="text-xs text-muted-foreground">
        {mounted && activitiesForDay(new Date()).length > 0
          ? `Hoy tienes ${activitiesForDay(new Date()).length} actividad(es).`
          : 'Sin actividades para hoy.'}
      </p>
    </div>
  );
}

function dayId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function MonthGrid({
  anchor,
  activities,
  onDayClick,
  onActivityClick,
}: {
  anchor: Date;
  activities: Activity[];
  onDayClick: (date: Date) => void;
  onActivityClick: (activity: Activity) => void;
}) {
  const days = buildMonthGrid(anchor);
  const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayActivities = activities.filter((a) => isSameDay(new Date(a.startAt), day));
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, new Date());
          return (
            <DroppableSlot
              key={day.toISOString()}
              id={`drop:${dayId(day)}:allday`}
              className={`min-h-[96px] cursor-pointer border-b border-r p-1.5 transition ${inMonth ? '' : 'bg-muted/30 text-muted-foreground'}`}
            >
              <div onClick={() => onDayClick(day)} className="flex h-full flex-col gap-1">
                <span className={`text-xs ${isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground' : ''}`}>
                  {day.getDate()}
                </span>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayActivities.slice(0, 3).map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} onClick={() => onActivityClick(activity)} compact />
                  ))}
                  {dayActivities.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayActivities.length - 3} más</span>
                  )}
                </div>
              </div>
            </DroppableSlot>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  activities,
  onSlotClick,
  onActivityClick,
}: {
  days: Date[];
  activities: Activity[];
  onSlotClick: (date: Date) => void;
  onActivityClick: (activity: Activity) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(140px, 1fr))` }}>
        <div className="border-b border-r bg-muted/50" />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-r bg-muted/50 p-2 text-center text-xs font-medium capitalize">
            {formatShortDay(day)}
          </div>
        ))}

        {HOUR_RANGE.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b border-r p-1 text-right text-[11px] text-muted-foreground">{formatHourLabel(hour)}</div>
            {days.map((day) => {
              const slotDate = new Date(day);
              slotDate.setHours(hour, 0, 0, 0);
              const slotActivities = activities.filter((a) => {
                const start = new Date(a.startAt);
                return isSameDay(start, day) && start.getHours() === hour;
              });
              return (
                <DroppableSlot
                  key={`${day.toISOString()}-${hour}`}
                  id={`drop:${dayId(day)}:${hour}`}
                  className="min-h-[44px] cursor-pointer border-b border-r p-0.5"
                >
                  <div onClick={() => onSlotClick(slotDate)} className="flex h-full flex-col gap-0.5">
                    {slotActivities.map((activity) => (
                      <ActivityCard key={activity.id} activity={activity} onClick={() => onActivityClick(activity)} />
                    ))}
                  </div>
                </DroppableSlot>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
