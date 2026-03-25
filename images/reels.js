/* ══════════════════════════════════════
   SHIELD — reels.js
   영상보기 (쉴드크리닉 · 큐티클 유니버스)
══════════════════════════════════════ */

/* ─── 콘텐츠 데이터 ───
   새 영상 추가 시 아래 배열에 항목만 추가하면 자동 반영됩니다.
   {
     title: "제목",
     desc:  "설명",
     link:  "인스타 릴스 URL",
     thumb: "./images/파일명.png"
   }
─────────────────────── */
var REELS_DATA = [
  {
    title: "열펌",
    desc:  "열펌을 하면 머리카락 속에서 어떤 일이 일어날까요?",
    link:  "https://www.instagram.com/reel/DVll-u7jypR/",
    thumb: "./images/hotperm.png"
  },
  {
    title: "일반펌",
    desc:  "일반펌을 하면 머리카락 속에서 어떤 일이 일어날까요?",
    link:  "https://www.instagram.com/reel/DVL1O7DDz5p/",
    thumb: "./images/coldperm.png"
  },
  {
    title: "염색",
    desc:  "염색을 하면 머리카락 속에서 어떤 일이 일어날까요?",
    link:  "https://www.instagram.com/reel/DU8VI0_D6ke/",
    thumb: "./images/color.png"
  },
  {
    title: "크리닉",
    desc:  "크리닉을 하면 머리카락 속에서 어떤 일이 일어날까요?",
    link:  "https://www.instagram.com/reel/DWOI9jIj-yj/",
    thumb: "./images/clinic.jpeg"
  },
  {
    title: "머리카락 성장",
    desc:  "머리카락은 어떻게 자라날까요?",
    link:  "https://www.instagram.com/reel/DWGRKGmj54p/",
    thumb: "./images/growth.png"
  },
  {
    title: "냄새",
    desc:  "미용실 특유의 냄새는 무엇일까요?",
    link:  "https://www.instagram.com/reel/DV_E96ej0N-/",
    thumb: "./images/smell.png"
  },
  {
    title: "성분",
    desc:  "염색약에는 어떤 성분이 들어있을까요?",
    link:  "https://www.instagram.com/reel/DVxzDZcD2bz/",
    thumb: "./images/ingredient.png"
  },
  {
    title: "탈색",
    desc:  "탈색을 하면 머리카락 속에서 어떤 일이 일어날까요?",
    link:  "https://www.instagram.com/reel/DVr9ljaD165/",
    thumb: "./images/bleach.jpeg"
  },
  {
    title: "보색중화",
    desc:  "보색중화를 하면 머리카락 속에서 어떤 일이 일어날까요?",
    link:  "https://www.instagram.com/reel/DVSWamFDyJE/",
    thumb: "./images/neutralize.jpeg"
  }
];

/* ── 렌더 ── */
function renderReels() {
  var grid = document.getElementById('reels-grid');
  if (!grid) return;
  grid.innerHTML = '';

  REELS_DATA.forEach(function(item, i) {
    var card = document.createElement('a');
    card.className = 'reel-card';
    card.href = item.link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.style.animationDelay = Math.min(i * 0.06, 0.4) + 's';

    card.innerHTML =
      '<div class="reel-thumb-wrap">' +
        '<img class="reel-thumb" src="' + item.thumb + '" alt="' + item.title + '" loading="lazy" />' +
        '<div class="reel-play-btn">' +
          '<svg viewBox="0 0 24 24" fill="white" width="28" height="28"><polygon points="5,3 19,12 5,21"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="reel-info">' +
        '<div class="reel-title">' + item.title + '</div>' +
        '<div class="reel-desc">' + item.desc + '</div>' +
        '<div class="reel-cta">Instagram Reels 보기 →</div>' +
      '</div>';

    grid.appendChild(card);
  });
}
