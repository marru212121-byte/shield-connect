// api/webhooks/cafe24.js
// POST /api/webhooks/cafe24
// 카페24가 결제완료/환불 이벤트 발생 시 자동 호출

import crypto from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { fetchOrder, fetchOrderItems } from '../../lib/cafe24.js';

function json(res, status, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
}

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[webhook] raw body 읽기 실패:', err);
    return json(res, 400, { error: 'invalid_body' });
  }

  const signature = req.headers['x-cafe24-hmac-sha256'] || req.headers['x-hmac-sha256'];
  const secret = process.env.CAFE24_WEBHOOK_SECRET;

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn('[webhook] 서명 검증 실패');
    return json(res, 401, { error: 'invalid_signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(res, 400, { error: 'invalid_json' });
  }

  console.log('[webhook] 이벤트 수신:', payload.event_no || payload.event);

  const resource = payload.resource || payload;
  const orderId = resource.order_id || resource.order?.order_id;

  if (!orderId) {
    console.warn('[webhook] order_id 없음');
    return json(res, 400, { error: 'missing_order_id' });
  }

  try {
    const { data: existing } = await supabase
      .from('order_redemptions')
      .select('cafe24_order_id')
      .eq('cafe24_order_id', orderId)
      .maybeSingle();

    if (existing) {
      console.log('[webhook] 이미 처리됨:', orderId);
      return json(res, 200, { ok: true, already_processed: true });
    }

    const orderResp = await fetchOrder(orderId);
    const order = orderResp?.order || orderResp;
    if (!order) {
      console.error('[webhook] 주문 조회 실패:', orderId);
      return json(res, 404, { error: 'order_not_found' });
    }

    let items = orderResp.items || order.items || order.order_items;
    if (!items || !items.length) {
      const itemsResp = await fetchOrderItems(orderId);
      items = Array.isArray(itemsResp)
        ? itemsResp
        : (itemsResp?.items || itemsResp?.order_items || []);
    }
    if (!items || !items.length) {
      console.error('[webhook] 아이템 없음:', orderId);
      return json(res, 400, { error: 'no_items' });
    }

    const productNos = [...new Set(
      items.map(it => Number(it.product_no || it.product_id)).filter(n => !isNaN(n))
    )];

    const { data: credits, error: cerr } = await supabase
      .from('product_credits')
      .select('cafe24_product_no, credits')
      .in('cafe24_product_no', productNos)
      .eq('active', true);

    if (cerr) {
      console.error('[webhook] DB 에러:', cerr);
      return json(res, 500, { error: 'db_error' });
    }
    if (!credits || !credits.length) {
      console.warn('[webhook] 매핑 안 된 상품:', productNos);
      return json(res, 200, { ok: true, skipped: 'not_a_credit_product' });
    }

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
    if (totalCredits <= 0) {
      return json(res, 200, { ok: true, skipped: 'no_credits_to_add' });
    }

    const cafe24MemberId = order.member_id;
    if (!cafe24MemberId) {
      console.warn('[webhook] 비회원 주문:', orderId);
      await logUnmatched(orderId, order, totalCredits);
      return json(res, 200, { ok: true, requires_manual: 'guest_order' });
    }

    const { data: shieldUser } = await supabase
      .from('users')
      .select('id')
      .eq('cafe24_member_id', cafe24MemberId)
      .maybeSingle();

    if (!shieldUser) {
      console.warn('[webhook] 유저 매칭 실패:', cafe24MemberId);
      await logUnmatched(orderId, order, totalCredits);
      return json(res, 200, { ok: true, requires_manual: 'user_not_found' });
    }

    const orderAmount = Math.round(Number(
      order.payment_amount || order.order_price_amount || order.total_price || 0
    ));

    const { data: result, error: rpcErr } = await supabase.rpc('redeem_order', {
      p_order_id: orderId,
      p_user_id: shieldUser.id,
      p_credits: totalCredits,
      p_product_no: firstProductNo,
      p_cafe24_member_id: cafe24MemberId,
      p_order_amount: orderAmount
    });

    if (rpcErr) {
      console.error('[webhook] RPC 실패:', rpcErr);
      return json(res, 500, { error: 'db_error', detail: rpcErr.message });
    }

    console.log('[webhook] 충전 성공:', orderId, '+', totalCredits);
    return json(res, 200, {
      ok: true,
      credits_added: totalCredits,
      user_id: shieldUser.id
    });
  } catch (err) {
    console.error('[webhook] 처리 중 에러:', err);
    return json(res, 500, { error: err.message });
  }
}

async function logUnmatched(orderId, order, credits) {
  try {
    await supabase.from('pending_redemptions').insert({
      cafe24_order_id: orderId,
      cafe24_member_id: order.member_id || null,
      buyer_name: order.billing_name || null,
      buyer_email: order.buyer_email || null,
      credits_to_add: credits,
      raw_payload: order,
      status: 'pending'
    });
  } catch (err) {
    console.error('[webhook] pending 기록 실패:', err);
  }
}
