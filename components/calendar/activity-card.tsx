'use client';

import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import type { Activity } from '@/lib/activities/activity-schema';

type Props = {
  activity: Activity;
  onClick: () => void;
  compact?: boolean;
};

export function ActivityCard({ activity, onClick, compact }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: { activity },
  });

  const color = activity.activityTypeColor || '#0EA5E9';

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ ...style, borderLeftColor: color, backgroundColor: `${color}1a` }}
      className={`w-full truncate rounded border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight text-foreground shadow-sm transition hover:opacity-80 ${
        isDragging ? 'opacity-50' : ''
      } ${compact ? '' : 'py-1'}`}
      title={activity.title}
    >
      {!activity.allDay && <span className="text-muted-foreground">{format(new Date(activity.startAt), 'HH:mm')} </span>}
      {activity.title}
    </button>
  );
}
