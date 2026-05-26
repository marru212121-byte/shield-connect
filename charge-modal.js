/* 쉴드 커넥트 — 충전 모달 + 복귀 토스트 (drop-in)
 * v3 (2026-05-14):
 *   - 슬라이드 다운 진입 애니메이션 (transform translateY)
 *   - X 버튼 44x44 원형 배경 (아이콘 22px)
 *   - 드래그 핸들 아래로 스와이프 = 닫기 (drag-to-dismiss)
 *   - 무제한 섹션 각 메뉴 우측 UNLIMITED 라임 배지
 *   - 충전 후 PWA 복귀 시 토스트 (기존 유지)
 *   - openChargeModal()    : 안내 모달 열기
 *   - gotoChargeDirect()   : 모달 없이 바로 카페24 (크레딧 부족 모달용)
 */

(function () {
  'use strict';

  var CAFE24_CHARGE_URL = 'https://marru2121.cafe24.com/surl/O/15';

  var LS_PRE_BALANCE = 'sc_pre_charge_balance';
  var LS_PRE_TIME    = 'sc_pre_charge_time';
  var STALE_MS       = 60 * 60 * 1000;

  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#C7F050" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>';
  var ICON_INFINITY = '<svg viewBox="0 0 24 24" fill="none" stroke="#C7F050" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0"><path d="M9.828 9.172a4 4 0 1 0 0 5.656a10 10 0 0 0 2.172 -2.828a10 10 0 0 1 2.172 -2.828a4 4 0 1 1 0 5.656a10 10 0 0 1 -2.172 -2.828a10 10 0 0 0 -2.172 -2.828"/></svg>';

  var UNLIMITED_BADGE = '<span style="background:#C7F050;color:#0A0A0A;font-size:9.5px;font-weight:800;padding:3px 7px;border-radius:5px;letter-spacing:0.4px;flex-shrink:0;line-height:1">UNLIMITED</span>';

  function featureBlock(opts) {
    var engineHTML = opts.engine
      ? '<span style="font-size:12px;color:#C7F050;font-weight:600;letter-spacing:0.2px">' + opts.engine + '</span>'
      : '';
    return ''
      + '<div style="margin-bottom:' + (opts.last ? '6px' : '16px') + '">'
      +   '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px;flex-wrap:wrap">'
      +     ICON_CHECK
      +     '<span style="font-size:13.5px;font-weight:700;color:#fff;letter-spacing:-0.2px">' + opts.title + '</span>'
      +     engineHTML
      +     '<span style="margin-left:auto;font-size:11px;color:#C7F050;font-weight:600">' + opts.max + '</span>'
      +   '</div>'
      +   '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:19px;margin-bottom:6px">' + opts.cost + '</div>'
      +   '<div style="font-size:11.5px;color:rgba(255,255,255,0.7);margin-left:19px;line-height:1.5">' + opts.desc1 + '</div>'
      +   '<div style="font-size:11.5px;color:rgba(255,255,255,0.55);margin-left:19px;line-height:1.5">' + opts.desc2 + '</div>'
      + '</div>';
  }

  /* 무제한 메뉴 블록 — 우측 UNLIMITED 배지 */
  function freeBlock(title, desc, last) {
    return ''
      + '<div style="' + (last ? '' : 'margin-bottom:11px;') + 'padding-left:10px;border-left:2px solid rgba(199,240,80,0.35);display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +   '<div style="min-width:0;flex:1">'
      +     '<div style="font-size:12.5px;color:#fff;font-weight:600;letter-spacing:-0.1px">' + title + '</div>'
      +     '<div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.5;margin-top:2px">' + desc + '</div>'
      +   '</div>'
      +   UNLIMITED_BADGE
      + '</div>';
  }

  var MODAL_HTML = ''
    + '<div id="sc-charge-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;overflow-y:auto;-webkit-overflow-scrolling:touch;opacity:0;transition:opacity 0.25s ease">'
    +   '<div style="min-height:100%;display:flex;align-items:flex-start;justify-content:center;padding:max(20px, env(safe-area-inset-top, 0px)) 12px max(40px, env(safe-area-inset-bottom, 0px));box-sizing:border-box">'
    +     '<div id="sc-charge-sheet" style="max-width:380px;width:100%;background:#0A0A0A;border-radius:20px;padding:0 16px 18px;border:1px solid rgba(255,255,255,0.08);box-sizing:border-box;transform:translateY(-100%);transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)">'

    +       '<div id="sc-drag-area" style="padding:10px 0 0;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none">'
    +         '<div style="display:flex;justify-content:center;margin-bottom:10px">'
    +           '<div style="width:48px;height:5px;background:rgba(255,255,255,0.3);border-radius:3px"></div>'
    +         '</div>'

    +         '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">'
    +           '<div style="font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:0.4px;font-weight:500">크레딧 충전</div>'
    +           '<button id="sc-charge-close" type="button" aria-label="닫기" style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;flex-shrink:0">' + ICON_X + '</button>'
    +         '</div>'
    +       '</div>'

    +       '<div style="text-align:center;margin-bottom:22px">'
    +         '<div style="font-size:19px;font-weight:700;color:#fff;letter-spacing:-0.4px;margin-bottom:4px;line-height:1.3">필요할 때 한 번씩, 저렴한 가격으로</div>'
    +         '<div style="font-size:11.5px;color:rgba(255,255,255,0.45)">월구독 없이 충전한 만큼만</div>'
    +       '</div>'

    +       '<div style="background:#1A1A1A;border:1px solid rgba(199,240,80,0.18);border-radius:16px;padding:22px 16px 18px;position:relative;margin-bottom:14px">'
    +         '<div style="position:absolute;top:-9px;left:16px;background:#C7F050;color:#0A0A0A;font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;letter-spacing:0.4px;box-shadow:0 0 0 2px #0A0A0A">BASIC</div>'

    +         '<div style="margin-bottom:18px">'
    +           '<div style="font-size:11px;color:#C7F050;opacity:0.75;letter-spacing:0.3px;font-weight:500;margin-bottom:8px">기본 충전</div>'
    +           '<div style="display:flex;align-items:baseline;gap:6px">'
    +             '<span style="font-size:34px;font-weight:800;color:#fff;letter-spacing:-1.2px;line-height:1">7,900</span>'
    +             '<span style="font-size:14px;color:rgba(255,255,255,0.55);font-weight:500">원</span>'
    +             '<span style="margin-left:auto;font-size:12px;color:rgba(255,255,255,0.55)">30크레딧</span>'
    +           '</div>'
    +         '</div>'

    +         '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px">'
    +           featureBlock({
                  title: 'HAIRO',
                  engine: 'nanobanana2',
                  max: '최대 30장',
                  cost: '1크레딧 / 장',
                  desc1: '앵글·무드 자동선택 or 프리 프롬프트 지원',
                  desc2: '살롱 워크 최적화 강력한 이미지 엔진'
                })
    +           featureBlock({
                  title: '컬러 애널라이저',
                  max: '최대 30회',
                  cost: '1크레딧 / 회',
                  desc1: 'AI 사고흐름 · 염색레시피 에이전트',
                  desc2: '사진별 컬러 분석 + 조색 레시피 + 상담 카드'
                })
    +           featureBlock({
                  title: '컷 애널라이저',
                  max: '최대 30회',
                  cost: '1크레딧 / 회',
                  desc1: '스타일 가이드 (레이어 시작점, 무게감)',
                  desc2: '고객 상담 카드 자동 생성',
                  last: true
                })
    +         '</div>'

    +         '<div style="text-align:center;margin-top:14px;font-size:11.5px;color:rgba(199,240,80,0.7);letter-spacing:-0.2px;font-weight:500">충전한 크레딧은 30일간 사용 가능합니다</div>'

    +         '<button id="sc-charge-cta" type="button" style="width:100%;background:#C7F050;color:#0A0A0A;border:none;padding:14px;border-radius:14px;font-size:14.5px;font-weight:700;letter-spacing:-0.2px;cursor:pointer;margin-top:10px;-webkit-tap-highlight-color:transparent;font-family:inherit">충전하기</button>'
    +       '</div>'

    +       '<div style="border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 14px 12px">'
    +         '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'
    +           ICON_INFINITY
    +           '<div>'
    +             '<div style="font-size:14px;color:#C7F050;font-weight:700;letter-spacing:-0.2px;line-height:1.2">무제한</div>'
    +             '<div style="font-size:10.5px;color:rgba(255,255,255,0.5);margin-top:2px">충전 없이 자유롭게 사용</div>'
    +           '</div>'
    +         '</div>'
    +         freeBlock('Color Journey', '여정형 게임으로 배우는 컬러레시피 추론 능력')
    +         freeBlock('약제 비율 계산기', '염색약 믹스 · 2제 비율 자동 계산')
    +         freeBlock('언더톤별 염색 이론', '룰 매트릭스 기반 가이드')
    +         freeBlock('성분사전', '헤어 화학 성분 레퍼런스')
    +         freeBlock('이론', '헤어 디자인 기본 이론')
    +         freeBlock('영상 보기', '쉴드걸과 쉽게 배우는 큐티클 유니버스 영상', true)
    +       '</div>'

    +     '</div>'
    +   '</div>'
    + '</div>';

  var TOAST_HTML = ''
    + '<div id="sc-charge-toast" style="display:none;position:fixed;left:50%;transform:translateX(-50%);top:max(16px, calc(env(safe-area-inset-top, 0px) + 12px));z-index:100000;width:calc(100% - 24px);max-width:360px;background:#0A0A0A;border:1px solid rgba(199,240,80,0.3);border-radius:14px;padding:14px 16px;box-shadow:0 8px 28px rgba(0,0,0,0.4);box-sizing:border-box">'
    +   '<div style="display:flex;align-items:flex-start;gap:10px">'
    +     '<div style="flex:1;min-width:0">'
    +       '<div id="sc-toast-line1" style="font-size:14px;font-weight:700;color:#C7F050;letter-spacing:-0.2px;line-height:1.3;margin-bottom:3px"></div>'
    +       '<div id="sc-toast-line2" style="font-size:12px;color:rgba(255,255,255,0.75);letter-spacing:-0.1px;line-height:1.4"></div>'
    +     '</div>'
    +     '<button id="sc-toast-close" type="button" aria-label="닫기" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.45);background:none;border:none;cursor:pointer;padding:0;margin:-2px -4px 0 0;-webkit-tap-highlight-color:transparent;flex-shrink:0">'
    +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    +     '</button>'
    +   '</div>'
    + '</div>'
    + '<style>@keyframes sc-toast-in{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes sc-toast-out{to{opacity:0;transform:translate(-50%,-8px)}}</style>';

  var initialized = false;
  var savedScrollY = 0;
  var toastTimer = null;
  var checking = false;

  var dragStartY = 0;
  var dragCurrentY = 0;
  var dragging = false;

  function init() {
    if (initialized) return;
    if (!document.body) return;

    var wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML + TOAST_HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    document.getElementById('sc-charge-close').onclick = closeChargeModal;
    document.getElementById('sc-charge-cta').onclick = gotoCharge;

    var overlay = document.getElementById('sc-charge-overlay');
    overlay.onclick = function (e) {
      if (e.target === overlay) closeChargeModal();
    };

    var toastClose = document.getElementById('sc-toast-close');
    if (toastClose) toastClose.onclick = hideToast;

    var dragArea = document.getElementById('sc-drag-area');
    if (dragArea) {
      dragArea.addEventListener('touchstart', onDragStart, { passive: true });
      dragArea.addEventListener('touchmove',  onDragMove,  { passive: false });
      dragArea.addEventListener('touchend',   onDragEnd,   { passive: true });
      dragArea.addEventListener('touchcancel', onDragEnd,  { passive: true });
      dragArea.addEventListener('mousedown',  onMouseDown);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.style.display !== 'none') {
        closeChargeModal();
      }
    });

    initialized = true;
  }

  /* 드래그-투-디스미스 */
  function onDragStart(e) {
    if (!e.touches || e.touches.length !== 1) return;
    if (e.target && e.target.closest && e.target.closest('#sc-charge-close')) return; /* X 버튼 탭은 드래그로 가로채지 않음 */
    dragStartY = e.touches[0].clientY;
    dragCurrentY = dragStartY;
    dragging = true;
    var sheet = document.getElementById('sc-charge-sheet');
    if (sheet) sheet.style.transition = 'none';
  }

  function onDragMove(e) {
    if (!dragging || !e.touches || e.touches.length !== 1) return;
    dragCurrentY = e.touches[0].clientY;
    var diff = dragCurrentY - dragStartY;
    if (diff < 0) diff = 0;
    e.preventDefault();
    var sheet = document.getElementById('sc-charge-sheet');
    var overlay = document.getElementById('sc-charge-overlay');
    if (sheet) sheet.style.transform = 'translateY(' + diff + 'px)';
    if (overlay) {
      var ratio = Math.min(diff / 300, 1);
      overlay.style.opacity = String(1 - ratio * 0.5);
    }
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    var diff = dragCurrentY - dragStartY;
    var sheet = document.getElementById('sc-charge-sheet');
    var overlay = document.getElementById('sc-charge-overlay');
    if (sheet) sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    if (overlay) overlay.style.transition = 'opacity 0.25s ease';

    if (diff > 100) {
      closeChargeModal();
    } else {
      if (sheet) sheet.style.transform = 'translateY(0)';
      if (overlay) overlay.style.opacity = '1';
    }
  }

  function onMouseDown(e) {
    if (e.target && e.target.closest && e.target.closest('#sc-charge-close')) return;
    dragStartY = e.clientY;
    dragCurrentY = dragStartY;
    dragging = true;
    var sheet = document.getElementById('sc-charge-sheet');
    if (sheet) sheet.style.transition = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }
  function onMouseMove(e) {
    if (!dragging) return;
    dragCurrentY = e.clientY;
    var diff = dragCurrentY - dragStartY;
    if (diff < 0) diff = 0;
    var sheet = document.getElementById('sc-charge-sheet');
    var overlay = document.getElementById('sc-charge-overlay');
    if (sheet) sheet.style.transform = 'translateY(' + diff + 'px)';
    if (overlay) {
      var ratio = Math.min(diff / 300, 1);
      overlay.style.opacity = String(1 - ratio * 0.5);
    }
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    onDragEnd();
  }

  function openChargeModal() {
    init();
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    var overlay = document.getElementById('sc-charge-overlay');
    var sheet   = document.getElementById('sc-charge-sheet');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedScrollY + 'px';
    document.body.style.width = '100%';
    void overlay.offsetWidth;
    overlay.style.opacity = '1';
    if (sheet) sheet.style.transform = 'translateY(0)';
  }

  function closeChargeModal() {
    var overlay = document.getElementById('sc-charge-overlay');
    var sheet   = document.getElementById('sc-charge-sheet');
    if (!overlay) return;
    overlay.style.opacity = '0';
    if (sheet) {
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      sheet.style.transform = 'translateY(-100%)';
    }
    setTimeout(function () {
      overlay.style.display = 'none';
      if (sheet) sheet.style.transform = 'translateY(-100%)';
      overlay.style.opacity = '0';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY);
    }, 280);
  }

  function readCurrentBalance() {
    if (window.SESSION && typeof window.SESSION.credits === 'number') {
      return window.SESSION.credits;
    }
    var el = document.getElementById('creditCountHeader');
    if (el) {
      var n = parseInt((el.textContent || '').replace(/[^0-9-]/g, ''), 10);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  function gotoChargeDirect() {
    if (!CAFE24_CHARGE_URL || CAFE24_CHARGE_URL.indexOf('REPLACE_') === 0) {
      alert('충전권 URL 설정이 필요합니다. (관리자에게 문의)');
      return;
    }
    try {
      var prev = readCurrentBalance();
      if (prev !== null) {
        localStorage.setItem(LS_PRE_BALANCE, String(prev));
        localStorage.setItem(LS_PRE_TIME, String(Date.now()));
      }
    } catch (e) {}
    window.location.href = CAFE24_CHARGE_URL;
  }

  function gotoCharge() {
    gotoChargeDirect();
  }

  function showToast(addedCredits, newBalance) {
    init();
    var t = document.getElementById('sc-charge-toast');
    if (!t) return;
    document.getElementById('sc-toast-line1').textContent = addedCredits + '크레딧이 충전되었어요';
    document.getElementById('sc-toast-line2').textContent = '현재 잔액 ' + newBalance + '크레딧';
    t.style.display = 'block';
    t.style.animation = 'sc-toast-in 0.3s ease';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3500);
  }

  /* 신규 가입 환영 토스트 (charge 토스트와 동일 컴포넌트 재사용) */
  function showSignupToast() {
    init();
    var t = document.getElementById('sc-charge-toast');
    if (!t) return;
    document.getElementById('sc-toast-line1').textContent = '환영합니다! 2크레딧이 지급되었어요';
    document.getElementById('sc-toast-line2').textContent = 'HAIRO 사진 1장 무료로 사용해보세요';
    t.style.display = 'block';
    t.style.animation = 'sc-toast-in 0.3s ease';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    var t = document.getElementById('sc-charge-toast');
    if (!t) return;
    t.style.animation = 'sc-toast-out 0.25s ease forwards';
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    setTimeout(function () { t.style.display = 'none'; }, 260);
  }

  /* 신규 가입 토스트 — 회원 단위 마크. 한 번 보면 해당 폰에서 다신 안 뜸 */
  var LS_SIGNUP_TOAST_PREFIX = 'sc_signup_toast_seen:';

  function checkSignupBonusToast() {
    /* 충전 토스트가 우선 — 이미 마크 있으면 그쪽에서 처리 */
    try {
      if (localStorage.getItem(LS_PRE_BALANCE) !== null) return;
    } catch (e) {}

    fetch('/api/customer/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.member_id) return;

        /* 조건: 보너스 받음 + 결제 0 + 사용 0 (= 진짜 신규) */
        if (!data.signup_bonus_given) return;
        if ((data.total_charged || 0) > 0) return;
        if ((data.total_used    || 0) > 0) return;

        var key = LS_SIGNUP_TOAST_PREFIX + data.member_id;
        try {
          if (localStorage.getItem(key)) return; /* 이미 봤음 */
          localStorage.setItem(key, '1');
        } catch (e) { return; }

        /* charge 토스트와 충돌 안 나도록 약간 지연 */
        setTimeout(showSignupToast, 600);
      })
      .catch(function () {});
  }

  function checkChargeReturn() {
    if (checking) return;
    var prevStr, prevTimeStr;
    try {
      prevStr     = localStorage.getItem(LS_PRE_BALANCE);
      prevTimeStr = localStorage.getItem(LS_PRE_TIME);
    } catch (e) { return; }
    if (prevStr === null || prevTimeStr === null) return;

    var prev     = parseInt(prevStr, 10);
    var prevTime = parseInt(prevTimeStr, 10);
    if (isNaN(prev) || isNaN(prevTime)) { clearChargeMark(); return; }
    if (Date.now() - prevTime > STALE_MS) { clearChargeMark(); return; }

    checking = true;
    fetch('/api/customer/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || typeof data.credits_remaining !== 'number') return;
        var curr = data.credits_remaining;
        var diff = curr - prev;
        if (diff > 0) {
          var el = document.getElementById('creditCountHeader');
          if (el) el.textContent = String(curr);
          if (window.SESSION) window.SESSION.credits = curr;
          if (typeof window.updateCreditBadge === 'function') {
            try { window.updateCreditBadge(curr); } catch (e) {}
          }
          showToast(diff, curr);
          clearChargeMark();
        }
      })
      .catch(function () {})
      .then(function () { checking = false; });
  }

  function clearChargeMark() {
    try {
      localStorage.removeItem(LS_PRE_BALANCE);
      localStorage.removeItem(LS_PRE_TIME);
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { checkChargeReturn(); checkSignupBonusToast(); }
  });
  window.addEventListener('pageshow', function () {
    checkChargeReturn();
    checkSignupBonusToast();
  });

  window.openChargeModal   = openChargeModal;
  window.closeChargeModal  = closeChargeModal;
  window.gotoChargeDirect  = gotoChargeDirect;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      checkChargeReturn();
      checkSignupBonusToast();
    });
  } else {
    init();
    checkChargeReturn();
    checkSignupBonusToast();
  }
})();
