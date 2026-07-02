'use server'

export async function refreshShippingOrder(
  mallOrderNumber: string
): Promise<{ ok: boolean; reason?: string }> {
  const proxyUrl = process.env.BOSS_API_PROXY_URL
  const apiKey = process.env.BOSS_PROXY_API_KEY

  if (!proxyUrl) {
    return { ok: false, reason: 'BOSS_API_PROXY_URL not configured' }
  }

  try {
    const res = await fetch(`${proxyUrl}/api/boss/find-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({ mallOrderNumber }),
      cache: 'no-store',
    })

    const data = await res.json()
    if (!data.ok) {
      return { ok: false, reason: data.reason ?? 'find_order_failed' }
    }
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return { ok: false, reason: msg }
  }
}
