import { z } from 'zod';

export const ACTIVITY_STATUSES = ['SCHEDULED', 'CANCELLED', 'DONE'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const REMINDER_OFFSET_OPTIONS = [
  { minutes: 15, label: '15 minutos antes' },
  { minutes: 30, label: '30 minutos antes' },
  { minutes: 60, label: '1 hora antes' },
  { minutes: 1440, label: '1 día antes' },
] as const;

export type Activity = {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  activityTypeId: string | null;
  activityTypeName: string | null;
  activityTypeColor: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  createdBy: string | null;
  location: string | null;
  notes: string | null;
  status: ActivityStatus;
  googleEventId: string | null;
  reminderOffsets: number[];
  isPrivate: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type ActivityType = {
  id: string;
  companyId: string;
  name: string;
  color: string;
};

const DEFAULT_ACTIVITY_TYPE_COLOR = '#0EA5E9';

export const ACTIVITY_TYPE_COLOR_PRESETS = [
  '#0EA5E9', // celeste
  '#16A34A', // verde
  '#EA580C', // naranja
  '#DC2626', // rojo
  '#7C3AED', // morado
  '#0D9488', // turquesa
  '#B45309', // dorado
  '#475569', // gris
];

export const createActivityTypeSchema = z.object({
  name: z.string().min(1).max(80),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default(DEFAULT_ACTIVITY_TYPE_COLOR),
});

export const ACTIVITY_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];

export const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  allDay: z.boolean().default(false),
  activityTypeId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  location: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
  reminderOffsets: z.array(z.number().int().min(0)).default([]),
  isPrivate: z.boolean().default(false),
  priority: z.enum(ACTIVITY_PRIORITIES).default('MEDIUM'),
});

export const updateActivitySchema = createActivitySchema;
