// api/orders/redeem.js
// POST /api/orders/redeem   body: { order_id }
//
// 플로우:
// 1) 세션 확인
// 2) DB에서 이미 사용된 주문번호인지 빠르게 확인 (fail-fast)
// 3) 카페24 API로 주문 조회 (존재·결제 상태 확인)
// 4) 주문 아이템의 상품번호 → product_credits에서 크레딧 합산 (화이트리스트)
// 5) Supabase RPC redeem_order로 트랜잭션 충전
//
// 반환: { success: true, credits_added: N, total_remaining: M }

import { getSessionUserId } from '../../lib/session.js';
import { supabase } from '../../lib/supabase.js';
import { fetchOrder, fetchOrderItems } from '../../lib/cafe24.js';

function json(res, status, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
}

// 카페24 주문·결제 상태 표기 다양성 흡수
function isPaid(order) {
  const ps = String(order?.payment_status || '').toLowerCase();
  const os = String(order?.order_status || '').toUpperCase();
  if (ps === 'paid' || ps === 'deposited') return true;
  if (['N10', 'N20', 'N21', 'N22', 'N30', 'N40', 'N50'].includes(os)) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const userId = getSessionUserId(req);
  if (!userId) return json(res, 401, { error: 'not_authenticated' });

  // body 파싱
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid_body' }); }
  }
  const orderId = String(body?.order_id || '').trim();
  if (!orderId) return json(res, 400, { error: 'missing_order_id' });

  // 1) 사전 중복 체크
  const { data: existing } = await supabase
    .from('order_redemptions')
    .select('cafe24_order_id, redeemed_by_user_id')
    .eq('cafe24_order_id', orderId)
    .maybeSingle();
  if (existing) {
    const mine = existing.redeemed_by_user_id === userId;
    return json(res, 409, {
      error: mine ? 'already_redeemed_by_you' : 'already_redeemed'
    });
  }

  try {
    // 2) 카페24에서 주문 조회
    const orderResp = await fetchOrder(orderId);
    if (!orderResp) return json(res, 404, { error: 'order_not_found' });

    // 카페24 응답은 { order: {...} } 형태
    const order = orderResp.order || orderResp;
    if (!order) return json(res, 404, { error: 'order_not_found' });

    // 3) 결제 여부 확인
    if (!isPaid(order)) {
      return json(res, 400, {
        error: 'not_paid',
        detail: `payment_status=${order.payment_status}, order_status=${order.order_status}`
      });
    }

    // 4) 아이템 수집: order 응답에 items가 있으면 사용, 없으면 별도 조회
    let items = orderResp.items || order.items || order.order_items;
    if (!items || !items.length) {
      const itemsResp = await fetchOrderItems(orderId);
      items = itemsResp?.items || itemsResp?.order_items || [];
    }
    if (!items || !items.length) return json(res, 400, { error: 'no_items' });

    const productNos = [...new Set(
      items.map(it => Number(it.product_no || it.product_id)).filter(n => !isNaN(n))
    )];
    if (!productNos.length) return json(res, 400, { error: 'no_product_no' });

    // 5) 화이트리스트 조회
    const { data: credits, error: cerr } = await supabase
      .from('product_credits')
      .select('cafe24_product_no, credits')
      .in('cafe24_product_no', productNos)
      .eq('active', true);

    if (cerr) return json(res, 500, { error: 'db_error', detail: cerr.message });
    if (!credits || !credits.length) return json(res, 400, { error: 'invalid_product' });

    const creditMap = new Map(credits.map(c => [c.cafe24_product_no, c.credits]));
    let totalCredits = 0;
    let firstProductNo = null;
    for (const it of items) {
      const no = Number(it.product_no || it.product_id);
      const qty = Number(it.quantity || 1);
      const per = creditMap.get(no);
      if (per) {
        totalCredits += per * qty;
        if (firstProductNo === null) firstProductNo = no;
      }
    }
    if (totalCredits <= 0) return json(res, 400, { error: 'no_credits_to_add' });

    // 6) RPC로 원자적 충전
    const orderAmount = Math.round(Number(
      order.payment_amount || order.order_price_amount || order.total_price || 0
    ));
    const { data: result, error: rpcErr } = await supabase.rpc('redeem_order', {
      p_order_id: orderId,
      p_user_id: userId,
      p_credits: totalCredits,
      p_product_no: firstProductNo,
      p_cafe24_member_id: order.member_id || null,
      p_order_amount: orderAmount
    });

    if (rpcErr) {
      console.error('[redeem] RPC 실패:', rpcErr);
      return json(res, 500, { error: 'db_error', detail: rpcErr.message });
    }
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.success) {
      return json(res, 409, { error: row?.message || 'redemption_failed' });
    }

    return json(res, 200, {
      success: true,
      credits_added: totalCredits,
      total_remaining: row.total_remaining
    });
  } catch (err) {
    console.error('[redeem] 에러:', err);
    return json(res, 500, { error: err.message });
  }
}
