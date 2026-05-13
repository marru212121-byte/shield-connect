/* 쉴드 커넥트 — 충전 모달 (drop-in)
 * 사용법:
 *   1. 각 페이지의 </body> 직전에 <script src="./charge-modal.js"></script>
 *   2. 어디서든 openChargeModal() 호출하면 모달 등장
 *   3. 아래 CAFE24_CHARGE_URL을 실제 카페24 상품 URL로 교체
 */

(function () {
  'use strict';

  /* ============================================================
     ⚠️ 여기만 교체: 카페24 충전권 상품 URL
     예: https://marru2121.cafe24.com/product/detail.html?product_no=99
     ============================================================ */
  var CAFE24_CHARGE_URL = 'https://marru2121.cafe24.com/surl/O/15';

  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#C7F050" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>';
  var ICON_INFINITY = '<svg viewBox="0 0 24 24" fill="none" stroke="#C7F050" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0"><path d="M9.828 9.172a4 4 0 1 0 0 5.656a10 10 0 0 0 2.172 -2.828a10 10 0 0 1 2.172 -2.828a4 4 0 1 1 0 5.656a10 10 0 0 1 -2.172 -2.828a10 10 0 0 0 -2.172 -2.828"/></svg>';

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

  function freeBlock(title, desc, last) {
    return ''
      + '<div style="' + (last ? '' : 'margin-bottom:11px;') + 'padding-left:10px;border-left:2px solid rgba(199,240,80,0.35)">'
      +   '<div style="font-size:12.5px;color:#fff;font-weight:600;letter-spacing:-0.1px">' + title + '</div>'
      +   '<div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.5;margin-top:2px">' + desc + '</div>'
      + '</div>';
  }

  var MODAL_HTML = ''
    + '<div id="sc-charge-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;overflow-y:auto;-webkit-overflow-scrolling:touch">'
    +   '<div style="min-height:100%;display:flex;align-items:flex-start;justify-content:center;padding:20px 12px 40px;box-sizing:border-box">'
    +     '<div style="max-width:380px;width:100%;background:#0A0A0A;border-radius:20px;padding:20px 16px 18px;border:1px solid rgba(255,255,255,0.08);box-sizing:border-box">'

    +       '<div style="display:flex;justify-content:center;margin-bottom:10px">'
    +         '<div style="width:48px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px"></div>'
    +       '</div>'

    +       '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">'
    +         '<div style="font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.5px;font-weight:500">크레딧 충전</div>'
    +         '<button id="sc-charge-close" type="button" aria-label="닫기" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);background:none;border:none;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent">' + ICON_X + '</button>'
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
                  max: '최대 15회',
                  cost: '2크레딧 / 회',
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

  var initialized = false;
  var savedScrollY = 0;

  function init() {
    if (initialized) return;
    if (!document.body) return;

    var wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML;
    var overlay = wrap.firstElementChild;
    document.body.appendChild(overlay);

    document.getElementById('sc-charge-close').onclick = closeChargeModal;
    document.getElementById('sc-charge-cta').onclick = gotoCharge;

    overlay.onclick = function (e) {
      if (e.target === overlay) closeChargeModal();
    };

    // ESC 키로 닫기
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.style.display !== 'none') {
        closeChargeModal();
      }
    });

    initialized = true;
  }

  function openChargeModal() {
    init();
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    document.getElementById('sc-charge-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedScrollY + 'px';
    document.body.style.width = '100%';
  }

  function closeChargeModal() {
    var o = document.getElementById('sc-charge-overlay');
    if (o) o.style.display = 'none';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
  }

  function gotoCharge() {
    if (!CAFE24_CHARGE_URL || CAFE24_CHARGE_URL.indexOf('REPLACE_') === 0) {
      alert('충전권 URL 설정이 필요합니다. (관리자에게 문의)');
      return;
    }
    window.location.href = CAFE24_CHARGE_URL;
  }

  window.openChargeModal = openChargeModal;
  window.closeChargeModal = closeChargeModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
