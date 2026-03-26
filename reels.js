/* ════════════════════════════════
   reels.js  —  쉴드 커넥트 영상 보기
   썸네일: ./images/reels/ 로컬 이미지
   클릭:   인스타그램 앱 바로 이동
════════════════════════════════ */

/* ── 영상 데이터 ──────────────────────────────────────────
   thumb  : ./images/reels/ 폴더 안 파일명
   url    : 인스타그램 릴스 링크
   title  : 카드 제목
   desc   : 짧은 설명
   tag    : 뱃지 태그 (선택)
──────────────────────────────────────────────────────── */
const REELS_DATA = [
  {
    thumb: './images/reels/reels_01.jpg',
    url:   'https://www.instagram.com/reel/XXXXXXXX1/',
    title: '큐티클 구조 이해',
    desc:  '모발의 가장 바깥층, 큐티클이 왜 중요한지 알아봐요',
    tag:   '기초'
  },
  {
    thumb: './images/reels/reels_02.jpg',
    url:   'https://www.instagram.com/reel/XXXXXXXX2/',
    title: '염모제 작용 원리',
    desc:  '색이 모발 속으로 들어가는 과정을 실사로 설명해요',
    tag:   '염색'
  },
  {
    thumb: './images/reels/reels_03.jpg',
    url:   'https://www.instagram.com/reel/XXXXXXXX3/',
    title: '펌 웨이브의 과학',
    desc:  '1액·2액이 모발 결합에 어떤 영향을 주는지 봐요',
    tag:   '펌'
  },
  {
    thumb: './images/reels/reels_04.jpg',
    url:   'https://www.instagram.com/reel/XXXXXXXX4/',
    title: '모발 손상 단계별 분석',
    desc:  '손상 레벨 1~5, 각 단계마다 어떻게 다른지 비교해요',
    tag:   '크리닉'
  },
  {
    thumb: './images/reels/reels_05.jpg',
    url:   'https://www.instagram.com/reel/XXXXXXXX5/',
    title: '산화제 농도와 리프트',
    desc:  '3% · 6% · 9% · 12% 차이를 한눈에 정리했어요',
    tag:   '염색'
  },
  {
    thumb: './images/reels/reels_06.jpg',
    url:   'https://www.instagram.com/reel/XXXXXXXX6/',
    title: '두피 타입 구별법',
    desc:  '지성·건성·민감성 두피를 구별하는 방법을 알아봐요',
    tag:   '두피'
  },
];


/* ── 렌더링 ───────────────────────────────────────────── */
function renderReels() {
  const grid = document.getElementById('reels-grid');
  if (!grid) return;

  if (REELS_DATA.length === 0) {
    grid.innerHTML = `
      <div class="reels-empty">
        <div class="reels-empty-icon">🎬</div>
        <p class="reels-empty-text">아직 등록된 영상이 없어요</p>
      </div>`;
    return;
  }

  grid.innerHTML = REELS_DATA.map((r, i) => `
    <a class="reel-card" href="${r.url}" target="_blank" rel="noopener noreferrer"
       onclick="reelCardClick(event, '${r.url}')">
      <div class="reel-thumb-wrap">
        <img
          class="reel-thumb"
          src="${r.thumb}"
          alt="${r.title}"
          loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
        />
        <div class="reel-thumb-fallback" style="display:none;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10,8 16,12 10,16" fill="rgba(255,255,255,0.4)" stroke="none"/>
          </svg>
        </div>
        ${r.tag ? `<span class="reel-tag-badge">${r.tag}</span>` : ''}
        <div class="reel-play-overlay">
          <div class="reel-play-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
              <polygon points="6,4 20,12 6,20"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="reel-info">
        <p class="reel-title">${r.title}</p>
        <p class="reel-desc">${r.desc}</p>
      </div>
    </a>
  `).join('');
}


/* ── 클릭 핸들러 (인스타그램 앱 우선 이동) ───────────────── */
function reelCardClick(e, url) {
  e.preventDefault();

  /* 인스타그램 딥링크: 앱이 있으면 앱으로, 없으면 브라우저로 */
  const instagramApp = url.replace('https://www.instagram.com', 'instagram://');

  /* 앱 실행 시도 → 일정 시간 후 앱이 안 열렸으면 브라우저로 fallback */
  const fallbackTimer = setTimeout(() => {
    window.location.href = url;
  }, 1200);

  /* 앱이 열리면 페이지가 blur → 타이머 취소 */
  window.addEventListener('blur', () => clearTimeout(fallbackTimer), { once: true });

  window.location.href = instagramApp;
}


/* ── 페이지 진입 시 자동 실행 ─────────────────────────────
   navigate('reels') 가 호출될 때 script.js 에서
   renderReels() 를 실행하거나,
   아래처럼 MutationObserver 로 자동 감지합니다.
──────────────────────────────────────────────────────── */
(function initReels() {
  /* DOM 준비 후 즉시 렌더 (페이지가 이미 보이는 경우) */
  const page = document.getElementById('page-reels');
  if (page && page.style.display !== 'none') renderReels();

  /* navigate() 로 페이지 전환될 때도 렌더되도록 감시 */
  if (page) {
    new MutationObserver(() => {
      if (page.style.display !== 'none') renderReels();
    }).observe(page, { attributes: true, attributeFilter: ['style'] });
  }
})();
