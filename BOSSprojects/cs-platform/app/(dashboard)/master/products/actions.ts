'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function logChange(
  db: any,
  tableName: string,
  recordId: string,
  oldValues: object | null,
  newValues: object,
  userId: string,
) {
  await db
    .from('master_change_logs')
    .insert({
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      changed_by: userId,
    })
    .catch(() => {})
}

export async function upsertProduct(data: {
  id?: string
  product_id?: string
  sku?: string
  product_name: string
  mall?: string
  asin?: string
  rakuten_item_code?: string
  yahoo_item_code?: string
  supplier?: string
  category?: string
  price?: number | null
  cost?: number | null
  is_active?: boolean
  memo?: string
  brand?: string
  sale_status?: string
  warranty_days?: number | null
  return_shipping_fee?: number | null
  dropbox_url?: string
  rakuten_url?: string
  parent_product_id?: string | null
}): Promise<{ error?: string; id?: string }> {
  try {
    const supabase = (await createClient()) as any
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: '認証が必要です' }

    const now = new Date().toISOString()

    const fields = {
      product_id: data.product_id ?? null,
      sku: data.sku ?? null,
      product_name: data.product_name,
      mall: data.mall ?? null,
      asin: data.asin ?? null,
      rakuten_item_code: data.rakuten_item_code ?? null,
      yahoo_item_code: data.yahoo_item_code ?? null,
      supplier: data.supplier ?? null,
      category: data.category ?? null,
      price: data.price ?? null,
      cost: data.cost ?? null,
      is_active: data.is_active ?? true,
      memo: data.memo ?? null,
      brand: data.brand ?? null,
      sale_status: data.sale_status ?? 'active',
      warranty_days: data.warranty_days ?? null,
      return_shipping_fee: data.return_shipping_fee ?? null,
      dropbox_url: data.dropbox_url ?? null,
      rakuten_url: data.rakuten_url ?? null,
      parent_product_id: data.parent_product_id ?? null,
      updated_at: now,
      updated_by: user.id,
    }

    if (data.id) {
      const { data: current, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', data.id)
        .single()
      if (fetchErr) return { error: fetchErr.message }

      const { error } = await supabase.from('products').update(fields).eq('id', data.id)
      if (error) return { error: error.message }

      logChange(supabase, 'products', data.id, current, fields, user.id)
      revalidatePath('/master/products')
      return { id: data.id }
    } else {
      const { data: inserted, error } = await supabase
        .from('products')
        .insert(fields)
        .select('id')
        .single()
      if (error) return { error: error.message }
      if (!inserted) return { error: '商品の登録に失敗しました' }

      logChange(supabase, 'products', inserted.id, null, fields, user.id)
      revalidatePath('/master/products')
      return { id: inserted.id }
    }
  } catch (e) {
    console.error('[upsertProduct]', e)
    return { error: e instanceof Error ? e.message : '予期しないエラーが発生しました' }
  }
}

export async function upsertProductKnowledge(data: {
  id?: string
  product_id: string
  synonyms?: string[]
  features?: string
  notes?: string
  campaign_name?: string
  campaign_detail?: string
  present_item?: string
  present_condition?: string
  present_summary?: string
  ai_notes?: string
  priority?: number
  is_active?: boolean
}): Promise<{ error?: string }> {
  try {
    const supabase = (await createClient()) as any
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: '認証が必要です' }

    const now = new Date().toISOString()

    if (data.id) {
      const { data: current } = await supabase
        .from('product_knowledge')
        .select('*')
        .eq('id', data.id)
        .single()

      const updates = {
        synonyms: data.synonyms ?? [],
        features: data.features ?? null,
        notes: data.notes ?? null,
        campaign_name: data.campaign_name ?? null,
        campaign_detail: data.campaign_detail ?? null,
        present_item: data.present_item ?? null,
        present_condition: data.present_condition ?? null,
        present_summary: data.present_summary ?? null,
        ai_notes: data.ai_notes ?? null,
        priority: data.priority ?? 0,
        is_active: data.is_active ?? true,
        updated_by: user.id,
        updated_at: now,
      }

      const { error } = await supabase.from('product_knowledge').update(updates).eq('id', data.id)
      if (error) return { error: error.message }
      logChange(supabase, 'product_knowledge', data.id, current, updates, user.id)
    } else {
      const insert = {
        product_id: data.product_id,
        synonyms: data.synonyms ?? [],
        features: data.features ?? null,
        notes: data.notes ?? null,
        campaign_name: data.campaign_name ?? null,
        campaign_detail: data.campaign_detail ?? null,
        present_item: data.present_item ?? null,
        present_condition: data.present_condition ?? null,
        present_summary: data.present_summary ?? null,
        ai_notes: data.ai_notes ?? null,
        priority: data.priority ?? 0,
        is_active: data.is_active ?? true,
        created_by: user.id,
        updated_by: user.id,
      }

      const { data: inserted, error } = await supabase
        .from('product_knowledge')
        .insert(insert)
        .select('id')
        .single()
      if (error) return { error: error.message }
      if (inserted) logChange(supabase, 'product_knowledge', inserted.id, null, insert, user.id)
    }

    revalidatePath('/master/products')
    return {}
  } catch (e) {
    console.error('[upsertProductKnowledge]', e)
    return { error: e instanceof Error ? e.message : '予期しないエラーが発生しました' }
  }
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  try {
    const supabase = (await createClient()) as any
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: '認証が必要です' }

    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/master/products')
    return {}
  } catch (e) {
    console.error('[deleteProduct]', e)
    return { error: e instanceof Error ? e.message : '予期しないエラーが発生しました' }
  }
}

export async function toggleProduct(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const now = new Date().toISOString()
  const updates = { is_active: isActive, updated_at: now, updated_by: user.id }

  const { data: current } = await supabase
    .from('products')
    .select('is_active')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('products').update(updates).eq('id', id)
  if (error) return { error: error.message }

  await logChange(supabase, 'products', id, current, updates, user.id)
  revalidatePath('/master/products')
  return {}
}

export async function importProducts(
  rows: Array<{
    product_name: string
    sku?: string
    asin?: string
    rakuten_item_code?: string
    yahoo_item_code?: string
    brand?: string
    category?: string
    mall?: string
    price?: number | null
    cost?: number | null
    warranty_days?: number | null
    sale_status?: string
    memo?: string
    synonyms?: string
    features?: string
    notes?: string
  }>,
): Promise<{ error?: string; imported: number; skipped: number }> {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です', imported: 0, skipped: 0 }

  let imported = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const row of rows) {
    if (!row.product_name?.trim()) { skipped++; continue }

    // Duplicate check: product_name + sku
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('product_name', row.product_name.trim())
      .maybeSingle()

    let productId: string
    if (existing?.id) {
      productId = existing.id
      skipped++
    } else {
      const { data: inserted, error } = await supabase
        .from('products')
        .insert({
          product_name: row.product_name.trim(),
          sku: row.sku || null,
          asin: row.asin || null,
          rakuten_item_code: row.rakuten_item_code || null,
          yahoo_item_code: row.yahoo_item_code || null,
          brand: row.brand || null,
          category: row.category || null,
          mall: row.mall || null,
          price: row.price ?? null,
          cost: row.cost ?? null,
          warranty_days: row.warranty_days ?? null,
          sale_status: row.sale_status || 'active',
          memo: row.memo || null,
          is_active: true,
          updated_at: now,
          updated_by: user.id,
        })
        .select('id')
        .single()

      if (error || !inserted) { skipped++; continue }
      productId = inserted.id
      imported++
    }

    // Insert product_knowledge if CS columns provided
    if (row.synonyms || row.features || row.notes) {
      const synonymsArr = row.synonyms
        ? row.synonyms.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean)
        : []
      await supabase.from('product_knowledge').insert({
        product_id: productId,
        synonyms: synonymsArr,
        features: row.features || null,
        notes: row.notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
    }
  }

  revalidatePath('/master/products')
  return { imported, skipped }
}
