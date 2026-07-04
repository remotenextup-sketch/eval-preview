import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProductsClient } from './ProductsClient'

export default async function ProductsPage() {
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: products }, { data: knowledgeRows }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, product_id, sku, product_name, mall, asin, rakuten_item_code, yahoo_item_code, supplier, category, price, cost, is_active, memo, brand, sale_status, warranty_days, return_shipping_fee, dropbox_url, rakuten_url, parent_product_id, updated_at',
      )
      .order('product_name', { ascending: true }),
    supabase
      .from('product_knowledge')
      .select(
        'id, product_id, synonyms, features, notes, campaign_name, campaign_detail, present_item, present_condition, present_summary, ai_notes, priority, is_active, updated_at',
      )
      .eq('is_active', true),
  ])

  return <ProductsClient products={products ?? []} knowledgeRows={knowledgeRows ?? []} />
}
