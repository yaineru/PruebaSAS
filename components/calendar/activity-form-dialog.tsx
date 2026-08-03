'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createActivity, updateActivity, deleteActivity } from '@/lib/actions/activities';
import { ACTIVITY_PRIORITIES, REMINDER_OFFSET_OPTIONS, type Activity, type ActivityType } from '@/lib/activities/activity-schema';
import { toDatetimeLocalValue } from '@/lib/activities/date-utils';

type CompanyUser = { id: string; full_name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create/update/delete so the calendar grid refetches immediately. */
  onMutated: () => void;
  activity?: Activity | null;
  activityTypes: ActivityType[];
  companyUsers: CompanyUser[];
  defaultStart?: Date;
};

function defaultRange(start?: Date) {
  const base = start ? new Date(start) : new Date();
  base.setMinutes(0, 0, 0);
  const end = new Date(base);
  end.setHours(end.getHours() + 1);
  return { start: base, end };
}

export function ActivityFormDialog({ open, onClose, onMutated, activity, activityTypes, companyUsers, defaultStart }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const isEditing = Boolean(activity);

  const initial = activity
    ? {
        title: activity.title,
        description: activity.description || '',
        startAt: toDatetimeLocalValue(activity.startAt),
        endAt: toDatetimeLocalValue(activity.endAt),
        allDay: activity.allDay,
        activityTypeId: activity.activityTypeId || '',
        ownerUserId: activity.ownerUserId || '',
        location: activity.location || '',
        notes: activity.notes || '',
        reminderOffsets: activity.reminderOffsets || [],
        isPrivate: activity.isPrivate,
        priority: activity.priority,
      }
    : (() => {
        const { start, end } = defaultRange(defaultStart);
        return {
          title: '',
          description: '',
          startAt: toDatetimeLocalValue(start.toISOString()),
          endAt: toDatetimeLocalValue(end.toISOString()),
          allDay: false,
          activityTypeId: activityTypes[0]?.id || '',
          ownerUserId: '',
          location: '',
          notes: '',
          reminderOffsets: [] as number[],
          isPrivate: false,
          priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
        };
      })();

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id, open]);

  if (!open) return null;

  const handleChange = (field: keyof typeof initial, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleReminder = (minutes: number) => {
    setForm((prev) => ({
      ...prev,
      reminderOffsets: prev.reminderOffsets.includes(minutes)
        ? prev.reminderOffsets.filter((m) => m !== minutes)
        : [...prev.reminderOffsets, minutes],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    // form.startAt/endAt are naive `datetime-local` values (no UTC offset).
    // For timed activities we convert through a real Date so the browser's
    // own timezone produces the correct UTC instant - the server process
    // (Vercel, UTC by default) must never be trusted to know the user's
    // Colombia local time. All-day activities instead keep only the literal
    // calendar date (pinned to UTC midnight) so a late-in-the-day pick can't
    // roll over to the next day once converted to UTC.
    if (form.allDay) {
      fd.append('startAt', `${form.startAt.slice(0, 10)}T00:00:00.000Z`);
      fd.append('endAt', `${form.endAt.slice(0, 10)}T00:00:00.000Z`);
    } else {
      fd.append('startAt', new Date(form.startAt).toISOString());
      fd.append('endAt', new Date(form.endAt).toISOString());
    }
    fd.append('allDay', String(form.allDay));
    if (form.activityTypeId) fd.append('activityTypeId', form.activityTypeId);
    if (form.ownerUserId) fd.append('ownerUserId', form.ownerUserId);
    fd.append('location', form.location);
    fd.append('notes', form.notes);
    fd.append('isPrivate', String(form.isPrivate));
    fd.append('priority', form.priority);
    form.reminderOffsets.forEach((minutes) => fd.append('reminderOffsets', String(minutes)));

    startTransition(async () => {
      const result = isEditing && activity ? await updateActivity(activity.id, fd) : await createActivity(fd);
      if (!result.success) {
        setError(result.error || 'No se pudo guardar la actividad.');
        return;
      }
      router.refresh();
      onMutated();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!activity) return;
    if (!confirm(`¿Eliminar la actividad "${activity.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteActivity(activity.id);
      if (!result.success) {
        setError(result.error || 'No se pudo eliminar la actividad.');
        return;
      }
      router.refresh();
      onMutated();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{isEditing ? 'Editar actividad' : 'Nueva actividad'}</CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={form.title} onChange={(e) => handleChange('title', e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startAt">Inicio</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => handleChange('startAt', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endAt">Fin</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => handleChange('endAt', e.target.value)}
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => handleChange('allDay', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Todo el día
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="activityTypeId">Tipo de actividad</Label>
                <select
                  id="activityTypeId"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.activityTypeId}
                  onChange={(e) => handleChange('activityTypeId', e.target.value)}
                >
                  <option value="">Sin tipo</option>
                  {activityTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ownerUserId">Asignado a</Label>
                <select
                  id="ownerUserId"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.ownerUserId}
                  onChange={(e) => handleChange('ownerUserId', e.target.value)}
                >
                  <option value="">Yo</option>
                  {companyUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="location">Ubicación</Label>
                <Input id="location" value={form.location} onChange={(e) => handleChange('location', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <select
                  id="priority"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                >
                  {ACTIVITY_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority === 'LOW' ? 'Baja' : priority === 'MEDIUM' ? 'Media' : 'Alta'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPrivate}
                onChange={(e) => handleChange('isPrivate', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Actividad privada (solo tú y los administradores la ven en el calendario compartido)
            </label>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <textarea
                id="description"
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div>
              <Label>Recordatorios</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REMINDER_OFFSET_OPTIONS.map((option) => (
                  <label key={option.minutes} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={form.reminderOffsets.includes(option.minutes)}
                      onChange={() => toggleReminder(option.minutes)}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}

            <div className="flex items-center justify-between gap-2 pt-2">
              {isEditing ? (
                <Button type="button" variant="ghost" className="text-red-600" onClick={handleDelete} disabled={isPending}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear actividad'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
