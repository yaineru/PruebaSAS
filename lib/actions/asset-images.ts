'use server';

import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit, sanitizeText } from '@/lib/security';
import { uploadImageSchema, createComparisonSchema } from '@/lib/images/image-schema';

const STORAGE_BUCKET = 'company-files';

async function assertAssetInCompany(assetId: string, companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('assets')
    .select('id')
    .eq('id', assetId)
    .eq('company_id', companyId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Photos are re-encoded to WebP before upload: camera-resolution originals
 * (several MB) would otherwise sit untouched in storage - resizing the
 * longest side and re-encoding keeps them print/gallery quality at a
 * fraction of the size (mirrors the same approach already used for report
 * evidence images in lib/reports/generators.ts).
 */
async function compressForUpload(buffer: Buffer): Promise<{ buffer: Buffer; width?: number; height?: number }> {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const resized = image.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
  const out = await resized.webp({ quality: 82 }).toBuffer();
  const outMeta = await sharp(out).metadata();
  return { buffer: out, width: outMeta.width ?? metadata.width, height: outMeta.height ?? metadata.height };
}

function buildStoragePath(companyId: string, assetId: string, originalName: string) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  return `${companyId}/asset-images/${assetId}/${Date.now()}-${safeName.replace(/\.[^.]+$/, '')}.webp`;
}

export async function uploadAssetImage(formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('uploadAssetImage', 20);

    const { companyId, userId } = await getTenantContext();

    const assetId = sanitizeText(formData.get('assetId') as string);
    const file = formData.get('file') as File | null;
    const imageType = (formData.get('imageType') as string) || 'REFERENCE';
    const title = sanitizeText((formData.get('title') as string) || '', 200) || undefined;
    const description = sanitizeText((formData.get('description') as string) || '', 1000) || undefined;

    if (!file) {
      return { success: false, error: 'No se recibió ningún archivo.' };
    }

    const validated = uploadImageSchema.parse({
      file,
      assetId,
      imageType,
      title,
      description,
    });

    if (!(await assertAssetInCompany(validated.assetId!, companyId))) {
      return { success: false, error: 'Equipo no encontrado.' };
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const { buffer: compressed, width, height } = await compressForUpload(originalBuffer);
    const storagePath = buildStoragePath(companyId, validated.assetId!, file.name);

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, compressed, { contentType: 'image/webp', upsert: false });

    if (uploadError) {
      console.error('Asset image upload error:', uploadError);
      return { success: false, error: 'No se pudo subir la imagen.' };
    }

    const { data: image, error: insertError } = await supabase
      .from('asset_images')
      .insert({
        company_id: companyId,
        asset_id: validated.assetId,
        file_name: file.name,
        file_path: storagePath,
        file_size_bytes: compressed.length,
        mime_type: 'image/webp',
        width,
        height,
        title: validated.title,
        description: validated.description,
        image_type: validated.imageType,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Asset image insert error:', insertError);
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return { success: false, error: 'No se pudo registrar la imagen.' };
    }

    revalidatePath(`/activos/${validated.assetId}`);
    return { success: true, image };
  } catch (error) {
    console.error('Upload asset image error:', error);
    return { success: false, error: 'No se pudo subir la imagen.' };
  }
}

export async function deleteAssetImage(imageId: string, assetId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('deleteAssetImage', 30);

    const { companyId } = await getTenantContext();
    const supabase = await createClient();

    const { data: image } = await supabase
      .from('asset_images')
      .select('id, file_path')
      .eq('id', imageId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!image) {
      return { success: false, error: 'Imagen no encontrada.' };
    }

    // El storage se borra primero (misma convención que components/document-actions.tsx):
    // si la policy de storage lo rechaza (solo ADMIN puede borrar en company-files),
    // se detiene aquí en vez de dejar el registro de BD sin su archivo.
    //
    // NOTA (auditoría de producción): a diferencia de una tabla Postgrest normal,
    // no pudimos verificar empíricamente si un remove() denegado por RLS aquí
    // responde con `error` o con éxito silencioso (0 objetos afectados) - las
    // pruebas con el cliente service-role no son concluyentes porque service-role
    // *siempre* bypassa RLS. Si en producción un ADMIN confirma que "eliminar"
    // una foto no borra el archivo subyacente en Storage, ese es el síntoma:
    // revisar aquí primero.
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([image.file_path]);
    if (storageError) {
      console.warn('Asset image storage delete failed', storageError.message);
      return { success: false, error: 'No se pudo eliminar el archivo. Se requiere rol de administrador.' };
    }

    const { error: deleteError } = await supabase
      .from('asset_images')
      .delete()
      .eq('id', imageId)
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('Asset image delete error:', deleteError);
      return { success: false, error: 'No se pudo eliminar el registro de la imagen.' };
    }

    revalidatePath(`/activos/${assetId}`);
    return { success: true };
  } catch (error) {
    console.error('Delete asset image error:', error);
    return { success: false, error: 'No se pudo eliminar la imagen.' };
  }
}

export async function replaceAssetImage(oldImageId: string, formData: FormData) {
  const assetId = sanitizeText(formData.get('assetId') as string);
  const deleteResult = await deleteAssetImage(oldImageId, assetId);
  if (!deleteResult.success) {
    return deleteResult;
  }
  return uploadAssetImage(formData);
}

export async function createImageComparison(formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('createImageComparison', 20);

    const { companyId } = await getTenantContext();

    const beforeImageId = sanitizeText(formData.get('beforeImageId') as string);
    const afterImageId = sanitizeText(formData.get('afterImageId') as string);
    const assetId = sanitizeText(formData.get('assetId') as string);
    const notes = sanitizeText((formData.get('notes') as string) || '', 1000) || undefined;

    const validated = createComparisonSchema.parse({
      beforeImageId,
      afterImageId,
      assetId,
      notes,
    });

    const supabase = await createClient();

    // Without this, a caller could reference asset_images ids belonging to
    // another tenant (IDOR): the insert below only scoped company_id on the
    // new comparison row itself, never checked that before/after images or
    // the asset actually belong to the caller's own company.
    const [{ data: beforeImage }, { data: afterImage }, { data: asset }] = await Promise.all([
      supabase.from('asset_images').select('id').eq('id', validated.beforeImageId).eq('company_id', companyId).maybeSingle(),
      supabase.from('asset_images').select('id').eq('id', validated.afterImageId).eq('company_id', companyId).maybeSingle(),
      supabase.from('assets').select('id').eq('id', validated.assetId).eq('company_id', companyId).maybeSingle(),
    ]);

    if (!beforeImage || !afterImage || !asset) {
      return { success: false, error: 'Una de las imágenes o el equipo no pertenece a tu empresa.' };
    }

    const { data: comparison, error } = await supabase
      .from('image_comparisons')
      .insert({
        company_id: companyId,
        before_image_id: validated.beforeImageId,
        after_image_id: validated.afterImageId,
        asset_id: validated.assetId,
        comparison_date: new Date().toISOString(),
        notes: validated.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Create image comparison error:', error);
      return { success: false, error: 'No se pudo crear la comparación.' };
    }

    revalidatePath(`/activos/${assetId}`);
    return { success: true, comparison };
  } catch (error) {
    console.error('Create image comparison error:', error);
    return { success: false, error: 'No se pudo crear la comparación.' };
  }
}
