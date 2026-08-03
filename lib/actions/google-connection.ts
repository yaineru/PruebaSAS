'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit } from '@/lib/security';

export async function disconnectGoogleCalendar() {
  try {
    await assertSameOrigin();
    await assertRateLimit('disconnectGoogleCalendar', 10);

    const { userId } = await getTenantContext();
    const supabase = await createClient();

    const { error } = await supabase.from('google_calendar_connections').delete().eq('user_id', userId);

    if (error) {
      console.error('Disconnect Google Calendar error:', error);
      return { success: false, error: 'No se pudo desconectar Google Calendar.' };
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Disconnect Google Calendar error:', error);
    return { success: false, error: 'No se pudo desconectar Google Calendar.' };
  }
}

export async function toggleGoogleSync(enabled: boolean) {
  try {
    await assertSameOrigin();
    await assertRateLimit('toggleGoogleSync', 20);

    const { userId } = await getTenantContext();
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_calendar_connections')
      .update({ sync_enabled: enabled })
      .eq('user_id', userId);

    if (error) {
      console.error('Toggle Google sync error:', error);
      return { success: false, error: 'No se pudo actualizar la sincronización.' };
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Toggle Google sync error:', error);
    return { success: false, error: 'No se pudo actualizar la sincronización.' };
  }
}
