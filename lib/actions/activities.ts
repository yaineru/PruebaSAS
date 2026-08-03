'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit, sanitizeText } from '@/lib/security';
import { createActivitySchema, createActivityTypeSchema, type Activity, type ActivityType } from '@/lib/activities/activity-schema';
import { syncActivityToGoogle, deleteActivityFromGoogle } from '@/lib/google/calendar-sync';

function parseActivityForm(formData: FormData) {
  const reminderOffsets = formData
    .getAll('reminderOffsets')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return createActivitySchema.parse({
    title: sanitizeText(formData.get('title') as string, 200),
    description: sanitizeText((formData.get('description') as string) || '', 2000) || undefined,
    startAt: formData.get('startAt') as string,
    endAt: formData.get('endAt') as string,
    allDay: formData.get('allDay') === 'true',
    activityTypeId: (formData.get('activityTypeId') as string) || undefined,
    ownerUserId: (formData.get('ownerUserId') as string) || undefined,
    location: sanitizeText((formData.get('location') as string) || '', 300) || undefined,
    notes: sanitizeText((formData.get('notes') as string) || '', 2000) || undefined,
    reminderOffsets,
    isPrivate: formData.get('isPrivate') === 'true',
    priority: ((formData.get('priority') as string) || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH',
  });
}

async function syncReminders(supabase: Awaited<ReturnType<typeof createClient>>, activityId: string, companyId: string, offsets: number[]) {
  await supabase.from('activity_reminders').delete().eq('activity_id', activityId);
  if (offsets.length === 0) return;
  await supabase.from('activity_reminders').insert(
    offsets.map((offsetMinutes) => ({
      activity_id: activityId,
      company_id: companyId,
      offset_minutes: offsetMinutes,
      channel: 'INAPP',
    }))
  );
}

export async function createActivity(formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('createActivity', 30);

    const { companyId, userId } = await getTenantContext();
    const validated = parseActivityForm(formData);

    if (new Date(validated.endAt) < new Date(validated.startAt)) {
      return { success: false, error: 'La hora de fin no puede ser anterior a la de inicio.' };
    }

    const supabase = await createClient();
    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        company_id: companyId,
        title: validated.title,
        description: validated.description || null,
        start_at: new Date(validated.startAt).toISOString(),
        end_at: new Date(validated.endAt).toISOString(),
        all_day: validated.allDay,
        activity_type_id: validated.activityTypeId || null,
        owner_user_id: validated.ownerUserId || userId,
        created_by: userId,
        updated_by: userId,
        location: validated.location || null,
        notes: validated.notes || null,
        status: 'SCHEDULED',
        is_private: validated.isPrivate,
        priority: validated.priority,
      })
      .select('id, owner_user_id')
      .single();

    if (error || !activity) {
      console.error('Create activity error:', error);
      return { success: false, error: 'No se pudo crear la actividad.' };
    }

    await syncReminders(supabase, activity.id, companyId, validated.reminderOffsets);

    const googleEventId = await syncActivityToGoogle(
      {
        title: validated.title,
        description: validated.description,
        startAt: new Date(validated.startAt).toISOString(),
        endAt: new Date(validated.endAt).toISOString(),
        allDay: validated.allDay,
        location: validated.location,
        googleEventId: null,
      },
      activity.owner_user_id
    );
    if (googleEventId) {
      await supabase.from('activities').update({ google_event_id: googleEventId }).eq('id', activity.id);
    }

    revalidatePath('/agenda');
    return { success: true, activityId: activity.id };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: 'Completa los campos requeridos correctamente.' };
    }
    console.error('Create activity error:', error);
    return { success: false, error: 'No se pudo crear la actividad.' };
  }
}

export async function updateActivity(activityId: string, formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('updateActivity', 30);

    const { companyId, userId } = await getTenantContext();
    const validated = parseActivityForm(formData);

    if (new Date(validated.endAt) < new Date(validated.startAt)) {
      return { success: false, error: 'La hora de fin no puede ser anterior a la de inicio.' };
    }

    const supabase = await createClient();
    const { data: activity, error } = await supabase
      .from('activities')
      .update({
        title: validated.title,
        description: validated.description || null,
        start_at: new Date(validated.startAt).toISOString(),
        end_at: new Date(validated.endAt).toISOString(),
        all_day: validated.allDay,
        activity_type_id: validated.activityTypeId || null,
        owner_user_id: validated.ownerUserId || userId,
        updated_by: userId,
        location: validated.location || null,
        notes: validated.notes || null,
        is_private: validated.isPrivate,
        priority: validated.priority,
      })
      .eq('id', activityId)
      .eq('company_id', companyId)
      .select('id, owner_user_id, google_event_id')
      .maybeSingle();

    if (error) {
      console.error('Update activity error:', error);
      return { success: false, error: 'No se pudo actualizar la actividad.' };
    }
    if (!activity) {
      return { success: false, error: 'No tienes permiso para editar esta actividad.' };
    }

    await syncReminders(supabase, activityId, companyId, validated.reminderOffsets);

    const googleEventId = await syncActivityToGoogle(
      {
        title: validated.title,
        description: validated.description,
        startAt: new Date(validated.startAt).toISOString(),
        endAt: new Date(validated.endAt).toISOString(),
        allDay: validated.allDay,
        location: validated.location,
        googleEventId: activity.google_event_id,
      },
      activity.owner_user_id
    );
    if (googleEventId && googleEventId !== activity.google_event_id) {
      await supabase.from('activities').update({ google_event_id: googleEventId }).eq('id', activityId);
    }

    revalidatePath('/agenda');
    return { success: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: 'Completa los campos requeridos correctamente.' };
    }
    console.error('Update activity error:', error);
    return { success: false, error: 'No se pudo actualizar la actividad.' };
  }
}

/** Lightweight action for drag-and-drop reschedule: patches only start_at/end_at. */
export async function rescheduleActivity(activityId: string, startAt: string, endAt: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('rescheduleActivity', 60);

    const { companyId, userId } = await getTenantContext();

    if (new Date(endAt) < new Date(startAt)) {
      return { success: false, error: 'Rango de horario inválido.' };
    }

    const supabase = await createClient();
    const { data: activity, error } = await supabase
      .from('activities')
      .update({
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        updated_by: userId,
      })
      .eq('id', activityId)
      .eq('company_id', companyId)
      .select('id, owner_user_id, google_event_id, title, description, all_day, location')
      .maybeSingle();

    if (error) {
      console.error('Reschedule activity error:', error);
      return { success: false, error: 'No se pudo mover la actividad.' };
    }
    if (!activity) {
      return { success: false, error: 'No tienes permiso para mover esta actividad.' };
    }

    const googleEventId = await syncActivityToGoogle(
      {
        title: activity.title,
        description: activity.description,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        allDay: activity.all_day,
        location: activity.location,
        googleEventId: activity.google_event_id,
      },
      activity.owner_user_id
    );
    if (googleEventId && googleEventId !== activity.google_event_id) {
      await supabase.from('activities').update({ google_event_id: googleEventId }).eq('id', activityId);
    }

    revalidatePath('/agenda');
    return { success: true };
  } catch (error) {
    console.error('Reschedule activity error:', error);
    return { success: false, error: 'No se pudo mover la actividad.' };
  }
}

export async function deleteActivity(activityId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('deleteActivity', 30);

    const { companyId } = await getTenantContext();
    const supabase = await createClient();

    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('id, owner_user_id, google_event_id')
      .eq('id', activityId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (fetchError || !activity) {
      return { success: false, error: 'Actividad no encontrada.' };
    }

    // A plain .update() with no matching row under RLS (e.g. an OPERARIO
    // trying to delete someone else's activity) returns `error: null` and 0
    // affected rows - Postgrest does not surface an RLS rejection as a query
    // error. .select().maybeSingle() forces us to check whether a row was
    // actually written, not just whether the query itself failed.
    const { data: updated, error } = await supabase
      .from('activities')
      .update({ status: 'CANCELLED', deleted_at: new Date().toISOString() })
      .eq('id', activityId)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Delete activity error:', error);
      return { success: false, error: 'No se pudo eliminar la actividad.' };
    }
    if (!updated) {
      return { success: false, error: 'No tienes permiso para eliminar esta actividad.' };
    }

    await deleteActivityFromGoogle(activity.google_event_id, activity.owner_user_id);

    revalidatePath('/agenda');
    return { success: true };
  } catch (error) {
    console.error('Delete activity error:', error);
    return { success: false, error: 'No se pudo eliminar la actividad.' };
  }
}

export async function createActivityType(formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('createActivityType', 20);

    const { companyId } = await getTenantContext();
    const validated = createActivityTypeSchema.parse({
      name: sanitizeText(formData.get('name') as string, 80),
      color: (formData.get('color') as string) || undefined,
    });

    const supabase = await createClient();
    const { data: activityType, error } = await supabase
      .from('activity_types')
      .insert({ company_id: companyId, name: validated.name, color: validated.color })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe un tipo de actividad con ese nombre.' };
      }
      console.error('Create activity type error:', error);
      return { success: false, error: 'No se pudo crear el tipo de actividad.' };
    }

    revalidatePath('/agenda');
    return { success: true, activityType };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: 'Datos inválidos.' };
    }
    console.error('Create activity type error:', error);
    return { success: false, error: 'No se pudo crear el tipo de actividad.' };
  }
}

export async function listActivitiesForRange(companyId: string, startIso: string, endIso: string): Promise<Activity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, company_id, title, description, start_at, end_at, all_day, status, location, notes, google_event_id, owner_user_id, created_by, is_private, priority, activity_type:activity_types(id, name, color), owner:users!activities_owner_user_id_fkey(full_name), reminders:activity_reminders(offset_minutes)'
    )
    .eq('company_id', companyId)
    .neq('status', 'CANCELLED')
    .is('deleted_at', null)
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .order('start_at', { ascending: true });

  if (error) {
    console.error('List activities error:', error);
    return [];
  }

  // activity_type/owner are many-to-one FK joins (single embedded object at
  // runtime); without generated DB types the query builder boxes them as
  // arrays, so the raw row is cast to the real runtime shape here.
  type ActivityRow = Omit<NonNullable<typeof data>[number], 'activity_type' | 'owner'> & {
    activity_type: { id: string; name: string; color: string } | null;
    owner: { full_name: string } | null;
  };

  return ((data || []) as unknown as ActivityRow[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    activityTypeId: row.activity_type?.id ?? null,
    activityTypeName: row.activity_type?.name ?? null,
    activityTypeColor: row.activity_type?.color ?? null,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner?.full_name ?? null,
    createdBy: row.created_by,
    location: row.location,
    notes: row.notes,
    status: row.status,
    googleEventId: row.google_event_id,
    reminderOffsets: (row.reminders || []).map((r) => r.offset_minutes),
    isPrivate: row.is_private,
    priority: row.priority,
  }));
}

export async function listActivityTypes(companyId: string): Promise<ActivityType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('activity_types')
    .select('id, company_id, name, color')
    .eq('company_id', companyId)
    .order('name', { ascending: true });
  return (data || []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    color: row.color,
  }));
}
