// api/webhook/cafe24.js
// ═══════════════════════════════════════════════════════════════
// 카페24 WebHook 수신 엔드포인트 (v24 핵심 파일)
// ═══════════════════════════════════════════════════════════════
// 수신 이벤트: 90023 (쇼핑몰에 주문이 접수된 경우)
// (기존 90025는 무통장/가상계좌 전용이라 제거됨)
//
// 처리 흐름:
//   1. Method / Content-Type 검증
//   2. X-API-Key 헤더로 발신자 검증 (카페24 진위 확인)
//   3. X-Trace-ID로 중복 수신 방지 (같은 웹훅 두 번 오면 무시)
//   4. event_no = 90023 이외 무시
//   5. 주문번호로 카페24 Admin API 호출 → 결제 상태 / 결제 방식 / 상품 목록 조회
//   6. 결제완료 상태 + 즉시결제 수단일 때만 진행
//      (무통장/가상계좌 들어오면 payment_status가 미결제라 자동 skip)
//   7. 주문 상품 중 product_credits에 등록된 상품의 크레딧 합산
//   8. RPC로 member_id에 크레딧 자동 충전
//   9. 200 OK 응답
//
// 카페24 규칙:
//   - 응답은 반드시 200대 상태코드 + 짧은 본문
//   - 10초 이내 응답해야 재시도 안 됨 (실패 시 자동 재시도)
// ═══════════════════════════════════════════════════════════════

import {
  verifyWebhookSignature,
  fetchOrder,
} from '../../lib/cafe24.js';
import { getSupabase } from '../../lib/supabase.js';

const TARGET_EVENT_NO = 90023;  // 주문 접수 이벤트

// 카페24 "입금완료/결제완료" 상태 코드
// https://developers.cafe24.com 주문 API 참고
const PAID_STATUS_VALUES = new Set([
  'T',           // T = 결제완료(Paid)
  'paid',
  'complete',
  '완납',
  '완불',
]);

// 즉시결제로 간주하는 결제수단 코드
// (사장님이 카페24에서 무통장/가상계좌 제거했으므로 실제로는 이것만 들어옴)
// 혹시 설정 실수 대비 코드 레벨 이중 안전장치
const IMMEDIATE_PAYMENT_METHODS = new Set([
  'card',            // 신용카드
  'cash',            // 실시간계좌이체
  'mobile',          // 휴대폰결제
  'naverpay',        // 네이버페이
  'kakaopay',        // 카카오페이
  'tosspay',         // 토스페이
  'payco',           // 페이코
  'samsungpay',      // 삼성페이
  'applepay',        // 애플페이
  'easypay',         // 간편결제 (일반)
]);

// 위험 결제수단 (이중 안전장치 — 이거 오면 충전 안 함)
const DELAYED_PAYMENT_METHODS = new Set([
  'bank',            // 무통장입금
  'vbank',           // 가상계좌
  'virtual_account',
  'escrow_card',     // 에스크로
  'escrow_bank',
]);

export default async function handler(req, res) {
  // ─── 1. Method 검증 ──────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // ─── 2. 발신자 검증 (X-API-Key) ──────────────────────────────
  const apiKey = req.headers['x-api-key'];
  if (!verifyWebhookSignature(apiKey)) {
    console.warn('[webhook/cafe24] signature verification failed');
    return res.status(401).json({ error: 'invalid_signature' });
  }

  // ─── 3. Trace ID (중복 방지용 고유값) ────────────────────────
  const traceId = req.headers['x-trace-id'];
  if (!traceId) {
    console.warn('[webhook/cafe24] missing trace id');
    return res.status(400).json({ error: 'missing_trace_id' });
  }

  // ─── 4. Body 파싱 ──────────────────────────────────────────
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }

  const eventNo = Number(body.event_no);
  const resource = body.resource || {};

  // ─── 5. 이벤트 번호 필터 ────────────────────────────────────
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
    // ─── 6. 중복 수신 체크 (멱등성) ────────────────────────────
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('trace_id')
      .eq('trace_id', traceId)
      .maybeSingle();

    if (existingEvent) {
      console.log('[webhook/cafe24] duplicate trace, already processed:', traceId);
      return res.status(200).json({ ok: true, ignored: 'duplicate' });
    }

    // ─── 7. 주문 조회 (카페24 Admin API) ───────────────────────
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

    // ─── 8. 결제 상태 체크 ─────────────────────────────────────
    const paymentStatus = normalizeStatus(
      order.payment_status || order.pay_status || order.order_status
    );
    if (!PAID_STATUS_VALUES.has(paymentStatus)) {
      console.log('[webhook/cafe24] not paid yet, skipping:', orderId, paymentStatus);
      return res.status(200).json({ ok: true, ignored: 'not_paid' });
    }

    // ─── 9. 결제 수단 체크 (이중 안전장치) ─────────────────────
    const paymentMethod = normalizeStatus(order.payment_method);
    if (DELAYED_PAYMENT_METHODS.has(paymentMethod)) {
      console.warn('[webhook/cafe24] delayed payment method detected, skipping:',
        orderId, paymentMethod);
      return res.status(200).json({ ok: true, ignored: 'delayed_payment' });
    }

    // ─── 10. member_id 추출 ───────────────────────────────────
    const memberId = order.member_id;
    if (!memberId) {
      console.warn('[webhook/cafe24] guest order, no member_id:', orderId);
      return res.status(200).json({ ok: true, ignored: 'guest_order' });
    }

    // ─── 11. 주문 상품 중 충전권 찾기 ──────────────────────────
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      console.warn('[webhook/cafe24] no items in order:', orderId);
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

    // ─── 12. 크레딧 충전 (RPC) ────────────────────────────────
    const { data: chargeResult, error: chargeError } = await supabase.rpc(
      'charge_credit_from_webhook',
      {
        p_trace_id: traceId,
        p_event_no: eventNo,
        p_order_id: orderId,
        p_mall_id: mallId,
        p_member_id: memberId,
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
      reason: result?.reason,
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

// ============================================================
// 헬퍼
// ============================================================
function normalizeStatus(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}
