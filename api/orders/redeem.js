// api/orders/redeem.js
// POST /api/orders/redeem   body: { order_id }
//
// v23.4 변경사항:
//   - 결제 상태 검증 완화 (카페24가 주문을 반환하면 "결제 검증된 주문"으로 인정)
//   - 2026-03-01 API에서 필드명 바뀌어서 undefined 반환되는 문제 해결
//   - 실제 응답 구조 로그로 찍어서 향후 참고

import { getSessionUserId } from '../../lib/session.js';
import { supabase } from '../../lib/supabase.js';
import { fetchOrder, fetchOrderItems } from '../../lib/cafe24.js';

function json(res, status, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
}

function isCanceledOrRefunded(order) {
  const os = String(order?.order_status || '').toUpperCase();
  const ps = String(order?.payment_status || '').toLowerCase();
  
  if (['C10', 'C20', 'C30', 'C40'].includes(os)) return true;
  if (ps === 'canceled' || ps === 'refunded' || ps === 'cancelled') return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const userId = getSessionUserId(req);
  if (!userId) return json(res, 401, { error: 'not_authenticated' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid_body' }); }
  }
  const orderId = String(body?.order_id || '').trim();
  if (!orderId) return json(res, 400, { error: 'missing_order_id' });

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
    const orderResp = await fetchOrder(orderId);
    if (!orderResp) return json(res, 404, { error: 'order_not_found' });

    const order = orderResp.order || orderResp;
    if (!order) return json(res, 404, { error: 'order_not_found' });

    console.log('[redeem] order keys:', Object.keys(order));
    console.log('[redeem] order_status:', order.order_status);
    console.log('[redeem] payment_status:', order.payment_status);
    console.log('[redeem] payments:', order.payments);

    if (isCanceledOrRefunded(order)) {
      return json(res, 400, {
        error: 'canceled_or_refunded',
        detail: `order_status=${order.order_status}, payment_status=${order.payment_status}`
      });
    }

    let items = orderResp.items || order.items || order.order_items;
    if (!items || !items.length) {
      const itemsResp = await fetchOrderItems(orderId);
      items = Array.isArray(itemsResp) ? itemsResp : (itemsResp?.items || itemsResp?.order_items || []);
    }
    if (!items || !items.length) return json(res, 400, { error: 'no_items' });

    console.log('[redeem] items count:', items.length);
    console.log('[redeem] first item keys:', items[0] ? Object.keys(items[0]) : 'empty');

    const productNos = [...new Set(
      items.map(it => Number(it.product_no || it.product_id)).filter(n => !isNaN(n))
    )];
    if (!productNos.length) return json(res, 400, { error: 'no_product_no' });

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
