/* ════════════════════════════════
   reels.js  —  시네마틱 영상 목록
   레이아웃: 가로 풀width 카드 (넷플릭스 시리즈 스타일)
   썸네일:   ./images/reels/ 로컬 이미지
   클릭:     인스타그램 앱 바로 이동
════════════════════════════════ */

const REELS_DATA = [
  {
    thumb: './images/hotperm.png',
    url:   'https://www.instagram.com/reel/DVll-u7jypR/',
    episode: 'EP.01',
    title: '열펌',
    desc:  '열펌을 하면 머리카락 속에서는 어떤 일이 일어날까요?',
    tag:   '펌'
  },
  {
    thumb: './images/coldperm.png',
    url:   'https://www.instagram.com/reel/DVL1O7DDz5p/',
    episode: 'EP.02',
    title: '일반펌',
    desc:  '일반펌을 하면 머리카락 속에서는 어떤 일이 일어날까요?',
    tag:   '펌'
  },
  {
    thumb: './images/bleach.jpeg',
    url:   'https://www.instagram.com/reel/DVr9ljaD165/',
    episode: 'EP.03',
    title: '탈색',
    desc:  '탈색을 하면 머리카락 속에서는 어떤 일이 일어날까요?',
    tag:   '탈색'
  },
  {
    thumb: './images/color.png',
    url:   'https://www.instagram.com/reel/DU8VI0_D6ke/',
    episode: 'EP.04',
    title: '염색',
    desc:  '염색을 하면 머리카락 속에서는 어떤 일이 일어날까요?',
    tag:   '염색'
  },
  {
    thumb: './images/neutralize.jpeg',
    url:   'https://www.instagram.com/reel/DVSWamFDyJE/',
    episode: 'EP.05',
    title: '보색 중화',
    desc:  '보색 중화를 하면 머리카락 속에서는 어떤 일이 일어날까요?',
    tag:   '컬러'
  },
  {
    thumb: './images/smell.png',
    url:   'https://www.instagram.com/reel/DV_E96ej0N-/',
    episode: 'EP.06',
    title: '미용실 특유의 냄새',
    desc:  '미용실에서 나는 특유의 냄새는 무엇일까요?',
    tag:   '상식'
  },
  {
    thumb: './images/growth.png',
    url:   'https://www.instagram.com/reel/DWGRKGmj54p/',
    episode: 'EP.07',
    title: '모발 성장',
    desc:  '머리카락은 어떻게 자라날까요?',
    tag:   '두피'
  },
  {
    thumb: './images/clinic.jpeg',
    url:   'https://www.instagram.com/reel/DWOI9jIj-yj/',
    episode: 'EP.08',
    title: '크리닉',
    desc:  '크리닉을 하면 머리카락에서 어떤 일이 일어날까요?',
    tag:   '크리닉'
  },
  {
    thumb: './images/dry.png',
    url:   'https://www.instagram.com/reel/DVDWofYD-XU/',
    episode: 'EP.09',
    title: '드라이',
    desc:  '드라이를 하면 머리카락에서 어떤 일이 일어날까요?',
    tag:   '스타일'
  },
   {
    thumb: './images/colorbase.png',
    url:   'https://www.instagram.com/reel/DVxzDZcD2bz/',
    episode: 'EP.10',
    title: '염색약속 성분',
    desc:  '염색약 속에는 어떤것이 들어있을까요?',
    tag:   '염색약성분'
  },
];


/* ── 렌더링 ───────────────────────────────────────────── */
function renderReels() {
  const grid = document.getElementById('reels-grid');
  if (!grid) return;

  grid.innerHTML = REELS_DATA.map((r) => `
    <a class="reel-row-card" href="${r.url}"
       onclick="reelCardClick(event,'${r.url}')" rel="noopener noreferrer">

      <div class="rrc-thumb-wrap">
        <img class="rrc-thumb" src="${r.thumb}" alt="${r.title}" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
        <div class="rrc-thumb-fallback" style="display:none;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="rgba(255,255,255,0.3)" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10,8 16,12 10,16" fill="rgba(255,255,255,0.3)" stroke="none"/>
          </svg>
        </div>
        <div class="rrc-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
            <polygon points="6,4 20,12 6,20"/>
          </svg>
        </div>
      </div>

      <div class="rrc-info">
        <div class="rrc-meta">
          <span class="rrc-episode">${r.episode}</span>
          <span class="rrc-tag">${r.tag}</span>
        </div>
        <p class="rrc-title">${r.title}</p>
        <p class="rrc-desc">${r.desc}</p>
        <div class="rrc-cta">
          인스타그램에서 보기
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </div>
      </div>

    </a>
  `).join('');
}


/* ── 인스타그램 앱 딥링크 ─────────────────────────────── */
function reelCardClick(e, url) {
  e.preventDefault();
  /* iOS: instagram:// 딥링크 시도 후 실패시 브라우저로 fallback */
  var fallback = setTimeout(function() {
    window.location.href = url;
  }, 1500);
  window.addEventListener('blur', function() {
    clearTimeout(fallback);
  }, { once: true });
  window.location.href = url;
}


/* ── 자동 초기화 ──────────────────────────────────────── */
(function initReels() {
  const page = document.getElementById('page-reels');
  if (!page) return;
  if (page.style.display !== 'none') renderReels();
  new MutationObserver(() => {
    if (page.style.display !== 'none') renderReels();
  }).observe(page, { attributes: true, attributeFilter: ['style'] });
})();
