/* ════════════════════════════════
   reels.js  —  시네마틱 영상 목록
   레이아웃: 가로 풀width 카드 (넷플릭스 시리즈 스타일)
   썸네일:   ./images/reels/ 로컬 이미지
   클릭:     인스타그램 앱 바로 이동
════════════════════════════════ */

const REELS_DATA = [
  {
    thumb: './images/reels/hotperm.png',
    url:   'https://www.instagram.com/reel/교체해주세요1/',
    episode: 'EP.01',
    title: '핫펌의 모든 것',
    desc:  '열을 이용해 웨이브를 만드는 핫펌. 시술 원리부터 주의사항까지 실사로 풀어봤어요.',
    tag:   '펌'
  },
  {
    thumb: './images/reels/coldperm.png',
    url:   'https://www.instagram.com/reel/교체해주세요2/',
    episode: 'EP.02',
    title: '콜드펌 vs 핫펌',
    desc:  '약제만으로 웨이브를 만드는 콜드펌. 두 가지의 결정적 차이를 비교해봐요.',
    tag:   '펌'
  },
  {
    thumb: './images/reels/bleach.jpeg',
    url:   'https://www.instagram.com/reel/교체해주세요3/',
    episode: 'EP.03',
    title: '블리치 작용 원리',
    desc:  '모발 속 멜라닌을 분해하는 블리치. 레벨별 리프트가 어떻게 달라지는지 알아봐요.',
    tag:   '탈색'
  },
  {
    thumb: './images/reels/color.png',
    url:   'https://www.instagram.com/reel/교체해주세요4/',
    episode: 'EP.04',
    title: '염모제 발색의 과학',
    desc:  '색소가 모발 속으로 파고드는 과정을 실사 기반으로 시각화했어요.',
    tag:   '염색'
  },
  {
    thumb: './images/reels/neutralize.jpeg',
    url:   'https://www.instagram.com/reel/교체해주세요5/',
    episode: 'EP.05',
    title: '보색 중화 완벽 정리',
    desc:  '노란기, 붉은기, 초록기… 각각 어떤 색으로 중화해야 하는지 한눈에 봐요.',
    tag:   '컬러'
  },
  {
    thumb: './images/reels/smell.png',
    url:   'https://www.instagram.com/reel/교체해주세요6/',
    episode: 'EP.06',
    title: '펌 냄새의 정체',
    desc:  '시술 후 남는 그 냄새, 어디서 오는 걸까요? 성분부터 제거 방법까지 알아봐요.',
    tag:   '펌'
  },
  {
    thumb: './images/reels/growth.png',
    url:   'https://www.instagram.com/reel/교체해주세요7/',
    episode: 'EP.07',
    title: '모발이 자라나는 과정',
    desc:  '두피 속에서 모발이 만들어지는 원리. 모낭 구조부터 성장 주기까지 파헤쳐요.',
    tag:   '두피'
  },
  {
    thumb: './images/reels/clinic.jpeg',
    url:   'https://www.instagram.com/reel/교체해주세요8/',
    episode: 'EP.08',
    title: '크리닉 제대로 쓰기',
    desc:  '그냥 바르면 의미없는 크리닉. 성분별 작용 부위와 올바른 사용법을 알아봐요.',
    tag:   '크리닉'
  },
  {
    thumb: './images/reels/dry.png',
    url:   'https://www.instagram.com/reel/교체해주세요9/',
    episode: 'EP.09',
    title: '드라이 기술의 핵심',
    desc:  '드라이어 하나로 완성도가 달라지는 이유. 바람 방향과 온도의 원리를 파헤쳐요.',
    tag:   '스타일'
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
  const appUrl = url.replace('https://www.instagram.com', 'instagram://');
  const fallback = setTimeout(() => { window.location.href = url; }, 1200);
  window.addEventListener('blur', () => clearTimeout(fallback), { once: true });
  window.location.href = appUrl;
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
