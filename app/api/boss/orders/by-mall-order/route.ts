import { NextResponse } from "next/server";
import { getBossAccessToken } from "@/lib/bossToken";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mallOrderNumber } = body;

    if (!mallOrderNumber || typeof mallOrderNumber !== "string") {
      return NextResponse.json(
        { ok: false, error: "mallOrderNumber is required" },
        { status: 400 }
      );
    }

    // 🔑 常に有効なアクセストークン
    const accessToken = await getBossAccessToken();

    /* =========================
       ① orders/search
    ========================= */
    const searchRes = await fetch(
      "https://api.boss-oms.jp/api/v1/orders/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mallOrderNumber,
          includeDeletedOrders: false,
        }),
      }
    );

    const searchText = await searchRes.text();
    let searchJson: any;
    try {
      searchJson = JSON.parse(searchText);
    } catch {
      searchJson = { raw: searchText };
    }

    if (!searchRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          stage: "orders.search",
          status: searchRes.status,
          data: searchJson,
        },
        { status: searchRes.status }
      );
    }

    const orderIds: number[] = searchJson.orders;

    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json({
        ok: true,
        found: false,
        message: "order not found",
        mallOrderNumber,
      });
    }

    /* =========================
       ② orders/list
    ========================= */
    const listRes = await fetch(
      "https://api.boss-oms.jp/api/v1/orders/list",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orders: orderIds,
        }),
      }
    );

    const listText = await listRes.text();
    let listJson: any;
    try {
      listJson = JSON.parse(listText);
    } catch {
      listJson = { raw: listText };
    }

    if (!listRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          stage: "orders.list",
          status: listRes.status,
          data: listJson,
        },
        { status: listRes.status }
      );
    }

    /* =========================
       ✅ 完成レスポンス
    ========================= */
    return NextResponse.json({
      ok: true,
      mallOrderNumber,
      orderIds,
      orders: listJson,
    });
  } catch (e: any) {
    console.error("by-mall-order error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "unknown error" },
      { status: 500 }
    );
  }
}

