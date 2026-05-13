// api/webhook/cafe24.js
// v26: customer lookup 제거 — order.member_id 그대로 사용
//   - callback.js v27이 tokens.user_id (= 자사몰 회원ID '3677479709@k') 형식으로 저장하므로
//     webhook도 동일한 형식인 order.member_id 를 그대로 쓰면 됨
//   - 기존 v25의 fetchCustomerByMemberId 호출 제거 (403 insufficient_scope 회피, 호출 자체 불필요)
//   - 이전 히스토리: v24까지는 member_id 그대로 적립 (정답이었음),
//     v25에서 user_identifier로 변환하다 ID 어긋남 발생,
//     v26에서 다시 member_id 직접 사용으로 정정

import { verifyWebhookSignature, fetchOrder } from '../../lib/cafe24.js';
import { getSupabase } from '../../lib/supabase.js';

const TARGET_EVENT_NO = 90023;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!verifyWebhookSignature(apiKey)) {
    console.warn('[webhook/cafe24] signature verification failed');
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const traceId = req.headers['x-trace-id'];
  if (!traceId) {
    console.warn('[webhook/cafe24] missing trace id');
    return res.status(400).json({ error: 'missing_trace_id' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }

  const eventNo = Number(body.event_no);
  const resource = body.resource || {};

  if (eventNo !== TARGET_EVENT_NO) {
    console.log('[webhook/cafe24] ignored non-target event:', eventNo);
    return res.status(200).json({ ok: true, ignored: 'non_target_event' });
  }

  const orderId = resource.order_id;
  const mallId = resource.mall_id;

  if (!orderId) {
    console.warn('[webhook/cafe24] missing order_id in payload');
    return res.status(400).json({ error: 'missing_order_id' });
  }

  const supabase = getSupabase();

  try {
    // 중복 체크
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('trace_id')
      .eq('trace_id', traceId)
      .maybeSingle();

    if (existingEvent) {
      console.log('[webhook/cafe24] duplicate trace:', traceId);
      return res.status(200).json({ ok: true, ignored: 'duplicate' });
    }

    // 주문 조회
    let orderData;
    try {
      orderData = await fetchOrder(orderId);
    } catch (err) {
      console.error('[webhook/cafe24] order fetch failed:', orderId, err.message);
      return res.status(502).json({ error: 'order_fetch_failed' });
    }

    const order = orderData?.order;
    if (!order) {
      console.warn('[webhook/cafe24] order not found:', orderId);
      return res.status(200).json({ ok: true, ignored: 'order_not_found' });
    }

    // ★★★ v26 핵심 ★★★
    // order.member_id (자사몰 회원ID, 예: '3677479709@k') 를 그대로 사용.
    // callback.js v27도 동일한 형식의 tokens.user_id 를 저장하므로 매핑 불필요.
    const memberId = order.member_id;
    if (!memberId) {
      console.warn('[webhook/cafe24] guest order:', orderId);
      return res.status(200).json({ ok: true, ignored: 'guest_order' });
    }

    console.log('[webhook/cafe24] member resolved:', memberId);

    // 상품 확인
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      console.warn('[webhook/cafe24] no items:', orderId);
      return res.status(200).json({ ok: true, ignored: 'no_items' });
    }

    const { data: productMap, error: mapError } = await supabase
      .from('product_credits')
      .select('cafe24_product_no, credits, active')
      .eq('active', true);

    if (mapError) {
      console.error('[webhook/cafe24] product_credits fetch failed:', mapError);
      return res.status(500).json({ error: 'internal' });
    }

    const creditMap = new Map();
    for (const row of productMap || []) {
      creditMap.set(Number(row.cafe24_product_no), Number(row.credits));
    }

    let totalCredits = 0;
    for (const item of items) {
      const productNo = Number(item.product_no);
      const quantity = Number(item.quantity) || 1;
      const creditsPerUnit = creditMap.get(productNo);
      if (creditsPerUnit) {
        totalCredits += creditsPerUnit * quantity;
      }
    }

    if (totalCredits === 0) {
      console.log('[webhook/cafe24] no credit products in order:', orderId);
      await supabase.from('webhook_events').insert({
        trace_id: traceId,
        event_no: eventNo,
        order_id: orderId,
        mall_id: mallId,
        raw_payload: body,
      });
      return res.status(200).json({ ok: true, ignored: 'no_credit_products' });
    }

    // 크레딧 충전 (자사몰 회원ID 그대로)
    const { data: chargeResult, error: chargeError } = await supabase.rpc(
      'charge_credit_from_webhook',
      {
        p_trace_id: traceId,
        p_event_no: eventNo,
        p_order_id: orderId,
        p_mall_id: mallId,
        p_member_id: memberId, // ← order.member_id (callback의 tokens.user_id와 동일 형식)
        p_credits: totalCredits,
        p_raw_payload: body,
      }
    );

    if (chargeError) {
      console.error('[webhook/cafe24] charge RPC failed:', chargeError);
      return res.status(500).json({ error: 'charge_failed' });
    }

    const result = Array.isArray(chargeResult) ? chargeResult[0] : chargeResult;
    console.log('[webhook/cafe24] charged:', {
      order_id: orderId,
      member_id: memberId,
      credits: totalCredits,
      remaining: result?.credits_remaining,
    });

    return res.status(200).json({
      ok: true,
      order_id: orderId,
      credits_charged: totalCredits,
      credits_remaining: result?.credits_remaining,
    });
  } catch (err) {
    console.error('[webhook/cafe24] unexpected error:', err);
    return res.status(500).json({ error: 'internal' });
  }
}
