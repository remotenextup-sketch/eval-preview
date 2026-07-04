/**
 * BOSS API interface / stub
 * TODO: 実際のAPIエンドポイントが決まり次第、stub実装を差し替える
 */

export type ExchangeRequest = {
  order_number: string
  mall: string
  item_name: string
  sku: string | null
  quantity: number
  reason: string
  memo: string | null
}

export type CancelRequest = {
  order_number: string
  mall: string
  item_name: string
  reason: string
  refund_amount: number | null
  memo: string | null
}

export type BossApiResponse = {
  success: boolean
  transaction_id: string | null
  message: string
  raw: unknown
}

export async function callBossExchange(req: ExchangeRequest): Promise<BossApiResponse> {
  // TODO: 実際のBOSS APIに差し替え
  // 例: const res = await fetch(`${process.env.BOSS_API_URL}/exchange`, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.BOSS_API_TOKEN}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify(req),
  // })
  console.log('[BOSS API STUB] exchange:', req)
  return {
    success: true,
    transaction_id: `STUB-EX-${Date.now()}`,
    message: '交換処理リクエストを受け付けました（スタブ実行）',
    raw: req,
  }
}

export async function callBossCancel(req: CancelRequest): Promise<BossApiResponse> {
  // TODO: 実際のBOSS APIに差し替え
  console.log('[BOSS API STUB] cancel:', req)
  return {
    success: true,
    transaction_id: `STUB-CA-${Date.now()}`,
    message: 'キャンセル処理リクエストを受け付けました（スタブ実行）',
    raw: req,
  }
}
