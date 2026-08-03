'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createActivityType } from '@/lib/actions/activities';
import { ACTIVITY_TYPE_COLOR_PRESETS, type ActivityType } from '@/lib/activities/activity-schema';

type Props = {
  open: boolean;
  onClose: () => void;
  activityTypes: ActivityType[];
};

export function ActivityTypeManager({ open, onClose, activityTypes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [color, setColor] = useState(ACTIVITY_TYPE_COLOR_PRESETS[0]);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    fd.append('name', name);
    fd.append('color', color);
    startTransition(async () => {
      const result = await createActivityType(fd);
      if (!result.success) {
        setError(result.error || 'No se pudo crear el tipo.');
        return;
      }
      setName('');
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Tipos de actividad</CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {activityTypes.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay tipos creados.</p>}
            {activityTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />
                {type.name}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t pt-3">
            <Input placeholder="Nombre (ej. Mantenimiento)" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="flex flex-wrap items-center gap-2">
              {ACTIVITY_TYPE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`h-6 w-6 rounded-full border-2 ${color === preset ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: preset }}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-6 rounded-full border" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="sm" disabled={isPending} className="w-full">
              {isPending ? 'Creando...' : 'Crear tipo'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
