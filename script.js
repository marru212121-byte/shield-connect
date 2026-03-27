/* ── 금액 포맷: 천 단위 콤마 ── */
function fmtMoney(n) {
  if (!n && n !== 0) return '0원';
  return Number(n).toLocaleString('ko-KR') + '원';
}

/* ── 릴스 주의바 닫기 ── */
function closeReelsNotice() {
  var n = document.getElementById('reels-notice');
  if (n) n.style.display = 'none';
}

/* ════════════════════════════════
   THEORY — 이론 슬라이드
════════════════════════════════ */

/* ── 데이터: 여기만 수정하면 됩니다 ──
   image: './images/파일명.jpg'
   text:  '카드 설명 텍스트'
─────────────────────────────────── */
var THEORY_HAIR_DATA = [
  {
    image: './images/quticle.jpeg',
    title: '모발의 구조',
    text: '모발은 바깥쪽부터 큐티클(Cuticle), 모피질(Cortex), 모수질(Medulla) 3겹으로 이루어져 있어요. 큐티클은 비늘처럼 겹쳐져 모발을 보호하고, 모피질은 색소와 수분을 담고 있어요.'
  },
  {
    image: './images/ph.jpg',
    title: '모발의 pH',
    text: '건강한 모발의 pH는 4.5~5.5 (약산성)이에요. pH가 높아질수록(알칼리) 큐티클이 열리고, 낮아질수록(산성) 닫혀요. 펌·염색 후 산성 처리를 하는 이유가 바로 이것이에요.'
  },
  {
    image: '',
    title: '준비 중',
    text: '다음 내용은 곧 업데이트됩니다.'
  }
];

var theoryIdx = 0;

function renderTheorySlider() {
  var data = THEORY_HAIR_DATA;
  var slider = document.getElementById('theory-slider');
  var dots = document.getElementById('theory-dots');
  var label = document.getElementById('theory-page-label');
  if (!slider) return;

  slider.innerHTML = data.map(function(card, i) {
    return '<div style="min-width:100%;box-sizing:border-box;padding:20px;">' +
      (card.image
        ? '<img src="' + card.image + '" alt="' + card.title + '" ' +
          'onclick="openTheoryImg(\'' + card.image + '\')" ' +
          'style="width:100%;max-height:55vw;object-fit:contain;border-radius:10px;cursor:zoom-in;display:block;margin-bottom:16px;" ' +
          'onerror="this.style.display=\'none\'"/>'
        : '<div style="height:120px;background:#f0f0ee;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:#bbb;font-size:13px;">이미지 준비 중</div>') +
      '<div style="font-size:16px;font-weight:700;color:#1A1814;margin-bottom:8px;">' + card.title + '</div>' +
      '<div style="font-size:13px;color:#666;line-height:1.7;">' + card.text + '</div>' +
    '</div>';
  }).join('');

  dots.innerHTML = data.map(function(_, i) {
    return '<div style="width:' + (i === theoryIdx ? '18' : '6') + 'px;height:6px;border-radius:3px;background:' + (i === theoryIdx ? '#1A1814' : '#ddd') + ';transition:all 0.3s;"></div>';
  }).join('');

  label.textContent = (theoryIdx + 1) + ' / ' + data.length;
  slider.style.transform = 'translateX(-' + (theoryIdx * 100) + '%)';
}

function theoryNext() {
  if (theoryIdx < THEORY_HAIR_DATA.length - 1) { theoryIdx++; renderTheorySlider(); }
}
function theoryPrev() {
  if (theoryIdx > 0) { theoryIdx--; renderTheorySlider(); }
}

function openTheoryImg(src) {
  var modal = document.getElementById('theory-img-modal');
  var img = document.getElementById('theory-img-full');
  if (modal && img) { img.src = src; modal.style.display = 'flex'; }
}
function closeTheoryImg() {
  var modal = document.getElementById('theory-img-modal');
  if (modal) modal.style.display = 'none';
}

function closeReelsNotice() {
  var n = document.getElementById('reels-notice');
  if (n) n.style.display = 'none';
}

/* ══════════════════════════════════════
   SHIELD DESIGNER CONNECT — script.js
══════════════════════════════════════ */

// ── 전역 상태 ──
const State = {
  currentPage: 'home',
  salesMonth:  new Date().getMonth(),
  salesYear:   new Date().getFullYear(),
  statsMonth:  new Date().getMonth(),
  statsYear:   new Date().getFullYear(),
  charts: { pie: null, bar: null }
};

// ── localStorage 헬퍼 ──
const Storage = {
  getData()     { return JSON.parse(localStorage.getItem('shieldSales') || '{}'); },
  setData(d)    { localStorage.setItem('shieldSales', JSON.stringify(d)); },
  getSettings() { return JSON.parse(localStorage.getItem('shieldSettings') || '{"goal":0,"owner":"디자이너"}'); },
  setSettings(s){ localStorage.setItem('shieldSettings', JSON.stringify(s)); }
};

// ── 숫자 포맷 ──
const fmt  = n => Number(n||0).toLocaleString('ko-KR');
const fmtW = n => Math.abs(n) >= 10000
  ? (n/10000).toFixed(1).replace(/\.0$/,'') + '만'
  : fmt(n);

// ── 날짜 키 ──
const dateKey = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

// ── 오늘 ──
const today = new Date();

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function navigate(page) {
  // 모든 페이지 숨김
  document.querySelectorAll('.page-screen').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) { target.style.display = 'block'; }

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  State.currentPage = page;

  // 성분사전 페이지는 하단 네비 숨김 (뒤로가기 버튼으로 홈 복귀)
  var nav = document.getElementById('bottomNav');
  if (nav) nav.style.display = (page === 'ingredient' || page === 'reels' || page === 'timer' || page === 'memo' || page === 'feedback' || page === 'theory' || page === 'theory-hair') ? 'none' : 'flex';

  if (page === 'sales')      renderCalendar();
  if (page === 'stats')      renderStats();
  if (page === 'settings')   renderSettings();
  if (page === 'ingredient') renderList();
  if (page === 'calculator') { setTimeout(initCalc, 50); }
  if (page === 'perm-calc') { setTimeout(initPermCalc, 50); }
  if (page === 'reels') { renderReels(); var n = document.getElementById('reels-notice'); if(n) n.style.display='flex'; }
  if (page === 'memo') { memoRender(); }
  if (page === 'theory-hair') { theoryIdx = 0; renderTheorySlider(); }
}

/* ══════════════════════════════════════
   HOME PAGE
══════════════════════════════════════ */
function initHome() {
  const s = Storage.getSettings();
  const owner = s.owner || '디자이너';
  document.getElementById('greetName').textContent = owner + '님 👋';
}

/* ══════════════════════════════════════
   SALES PAGE — 달력
══════════════════════════════════════ */
function renderCalendar() {
  const y = State.salesYear, m = State.salesMonth;
  const data = Storage.getData();
  const settings = Storage.getSettings();

  // 월 타이틀
  document.getElementById('calMonthTitle').textContent =
    `${y}년 ${m+1}월`;

  // 월 총 매출 계산
  let monthTotal = 0;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(y, m, d);
    if (data[k]) {
      const day = data[k];
      monthTotal += (day.cut||0) + (day.color||0) + (day.perm||0) + (day.clinic||0);
    }
  }

  // 목표 대비
  const goal = settings.goal || 0;
  const pct  = goal > 0 ? Math.min(100, Math.round(monthTotal / goal * 100)) : 0;
  const diff = goal - monthTotal;

  document.getElementById('monthTotalVal').textContent  = fmt(monthTotal) + '원';
  document.getElementById('monthGoalVal').textContent   = goal > 0 ? fmt(goal) + '원' : '미설정';
  document.getElementById('goalBarFill').style.width    = pct + '%';
  document.getElementById('goalPct').textContent        = pct + '%';
  document.getElementById('goalDiff').textContent       =
    goal > 0 ? (diff > 0 ? '부족 ' + fmtW(diff) + '원' : '달성! +' + fmtW(-diff) + '원') : '';

  // 평균
  const workedDays = Object.keys(data).filter(k => {
    const [ky,km] = k.split('-').map(Number);
    return ky === y && km-1 === m;
  }).length;
  document.getElementById('monthAvgVal').textContent =
    workedDays > 0 ? fmtW(Math.round(monthTotal / workedDays)) + '원' : '-';
  document.getElementById('monthDaysVal').textContent = workedDays + '일';

  // 달력 그리기
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // 빈 칸
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(y, m, d);
    const dayData = data[k];
    const dayTotal = dayData
      ? (dayData.cut||0)+(dayData.color||0)+(dayData.perm||0)+(dayData.clinic||0)
      : 0;

    const cell = document.createElement('div');
    const dow = new Date(y, m, d).getDay();
    let cls = 'cal-cell';
    if (dow === 0) cls += ' sunday';
    if (dow === 6) cls += ' saturday';
    if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) cls += ' today';
    if (dayTotal > 0) cls += ' has-data';
    cell.className = cls;

    cell.innerHTML = `
      <span class="cal-date">${d}</span>
      ${dayTotal > 0 ? `<span class="cal-sales">${fmtW(dayTotal)}</span>` : ''}
    `;
    cell.addEventListener('click', () => openModal(y, m, d));
    grid.appendChild(cell);
  }
}

function calPrevMonth() {
  State.salesMonth--;
  if (State.salesMonth < 0) { State.salesMonth = 11; State.salesYear--; }
  renderCalendar();
}
function calNextMonth() {
  State.salesMonth++;
  if (State.salesMonth > 11) { State.salesMonth = 0; State.salesYear++; }
  renderCalendar();
}

/* ══════════════════════════════════════
   MODAL — 일별 매출 입력
══════════════════════════════════════ */
function openModal(y, m, d) {
  var data    = Storage.getData();
  var k       = dateKey(y, m, d);
  var dayData = data[k] || null;
  var hasData = dayData && ((dayData.cut||0)+(dayData.color||0)+(dayData.perm||0)+(dayData.clinic||0)) > 0;
  var days = ['일','월','화','수','목','금','토'];
  var dow  = new Date(y, m, d).getDay();
  var d2   = dayData || { cut:0, color:0, perm:0, clinic:0 };

  document.getElementById('modalTitle').textContent =
    (m+1) + '월 ' + d + '일 (' + days[dow] + ') ' + (hasData ? '매출 내역' : '매출 입력');

  document.getElementById('modalOverlay').dataset.y = y;
  document.getElementById('modalOverlay').dataset.m = m;
  document.getElementById('modalOverlay').dataset.d = d;

  if (hasData) {
    document.getElementById('modal-view-mode').style.display = 'block';
    document.getElementById('modal-edit-mode').style.display = 'none';
    document.getElementById('view-cut').textContent    = fmt(d2.cut||0) + '원';
    document.getElementById('view-color').textContent  = fmt(d2.color||0) + '원';
    document.getElementById('view-perm').textContent   = fmt(d2.perm||0) + '원';
    document.getElementById('view-clinic').textContent = fmt(d2.clinic||0) + '원';
    document.getElementById('viewTotalVal').textContent = fmt((d2.cut||0)+(d2.color||0)+(d2.perm||0)+(d2.clinic||0)) + '원';
    document.getElementById('modalDeleteBtn2').onclick = function() { deleteModal(y, m, d); };
  } else {
    document.getElementById('modal-view-mode').style.display = 'none';
    document.getElementById('modal-edit-mode').style.display = 'block';
    ['cut','color','perm','clinic'].forEach(function(id) { document.getElementById('inp-'+id).value = ''; });
    updateModalTotal();
    document.getElementById('modalDeleteBtn').classList.add('hidden');
    document.getElementById('modalSaveBtn').onclick = function() { saveModal(y, m, d); };
  }

  document.getElementById('modalOverlay').classList.remove('hidden');
}

function switchToEditMode() {
  var overlay = document.getElementById('modalOverlay');
  var y = Number(overlay.dataset.y);
  var m = Number(overlay.dataset.m);
  var d = Number(overlay.dataset.d);
  var data    = Storage.getData();
  var k       = dateKey(y, m, d);
  var dayData = data[k] || { cut:0, color:0, perm:0, clinic:0 };
  var days = ['일','월','화','수','목','금','토'];
  var dow  = new Date(y, m, d).getDay();

  document.getElementById('modalTitle').textContent = (m+1) + '월 ' + d + '일 (' + days[dow] + ') 매출 수정';
  document.getElementById('modal-view-mode').style.display = 'none';
  document.getElementById('modal-edit-mode').style.display = 'block';

  document.getElementById('inp-cut').value    = dayData.cut    || '';
  document.getElementById('inp-color').value  = dayData.color  || '';
  document.getElementById('inp-perm').value   = dayData.perm   || '';
  document.getElementById('inp-clinic').value = dayData.clinic || '';
  updateModalTotal();

  var delBtn = document.getElementById('modalDeleteBtn');
  delBtn.classList.remove('hidden');
  delBtn.onclick = function() { deleteModal(y, m, d); };
  document.getElementById('modalSaveBtn').onclick = function() { saveModal(y, m, d); };
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function updateModalTotal() {
  const vals = ['cut','color','perm','clinic'].map(id => {
    const raw = (document.getElementById('inp-'+id).value || '').replace(/,/g,'');
    return Number(raw) || 0;
  });
  const total = vals.reduce((a,b) => a+b, 0);
  const el = document.getElementById('modalTotalVal');
  if (el) el.textContent = fmtMoney(total);
}

function saveModal(y, m, d) {
  const k    = dateKey(y, m, d);
  const data = Storage.getData();

  const cut    = Number((document.getElementById('inp-cut').value    || '0').replace(/,/g,''));
  const color  = Number((document.getElementById('inp-color').value  || '0').replace(/,/g,''));
  const perm   = Number((document.getElementById('inp-perm').value   || '0').replace(/,/g,''));
  const clinic = Number((document.getElementById('inp-clinic').value || '0').replace(/,/g,''));

  if (cut + color + perm + clinic === 0) {
    delete data[k];
  } else {
    data[k] = { cut, color, perm, clinic };
  }

  Storage.setData(data);
  closeModal();
  renderCalendar();
}

function deleteModal(y, m, d) {
  if (!confirm(`${m+1}월 ${d}일 매출 데이터를 삭제할까요?`)) return;
  const k    = dateKey(y, m, d);
  const data = Storage.getData();
  delete data[k];
  Storage.setData(data);
  closeModal();
  renderCalendar();
  showToast('매출 데이터가 삭제되었습니다');
}

/* ══════════════════════════════════════
   STATS PAGE
══════════════════════════════════════ */
function renderStats() {
  const y = State.statsYear, m = State.statsMonth;
  const data     = Storage.getData();
  const settings = Storage.getSettings();

  document.getElementById('statsMonthTitle').textContent = `${y}년 ${m+1}월 통계`;

  const daysInMonth = new Date(y, m+1, 0).getDate();
  let total = 0, cut = 0, color = 0, perm = 0, clinic = 0;
  let workedDays = 0;
  const dailyTotals = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(y, m, d);
    const dd = data[k];
    if (dd) {
      const daySum = (dd.cut||0)+(dd.color||0)+(dd.perm||0)+(dd.clinic||0);
      total  += daySum;
      cut    += dd.cut    || 0;
      color  += dd.color  || 0;
      perm   += dd.perm   || 0;
      clinic += dd.clinic || 0;
      if (daySum > 0) workedDays++;
      dailyTotals.push({ d, val: daySum });
    } else {
      dailyTotals.push({ d, val: 0 });
    }
  }

  const goal = settings.goal || 0;
  const avg  = workedDays > 0 ? Math.round(total / workedDays) : 0;
  const diff = goal - total;

  // 요약
  document.getElementById('statTotal').textContent    = fmt(total) + '원';
  document.getElementById('statGoal').textContent     = goal > 0 ? fmt(goal) + '원' : '미설정';
  document.getElementById('statDiff').textContent     =
    goal > 0 ? (diff > 0 ? '-' + fmt(diff) + '원' : '+' + fmt(-diff) + '원') : '-';
  document.getElementById('statDiff').className       =
    's-value ' + (diff > 0 ? 'danger' : 'accent');
  document.getElementById('statAvg').textContent      = fmt(avg) + '원';
  document.getElementById('statDays').textContent     = workedDays + '일';

  // 카테고리 바
  const cats = [
    { id:'cut',    name:'컷트',   val:cut,    cls:'cut'    },
    { id:'color',  name:'염색',   val:color,  cls:'color'  },
    { id:'perm',   name:'펌',     val:perm,   cls:'perm'   },
    { id:'clinic', name:'크리닉', val:clinic, cls:'clinic' },
  ];
  cats.forEach(c => {
    const pct = total > 0 ? Math.round(c.val / total * 100) : 0;
    const bar = document.getElementById('bar-' + c.id);
    if (bar) { bar.style.width = pct + '%'; }
    const pctEl = document.getElementById('pct-' + c.id);
    if (pctEl) pctEl.textContent = pct + '%';
    const amtEl = document.getElementById('amt-' + c.id);
    if (amtEl) amtEl.textContent = fmtW(c.val) + '원';
  });

  // 차트 렌더
  renderPieChart(cut, color, perm, clinic, total);
  renderBarChart(dailyTotals);
}

function renderPieChart(cut, color, perm, clinic, total) {
  const canvas = document.getElementById('pieChart');
  if (!canvas) return;
  if (State.charts.pie) { State.charts.pie.destroy(); State.charts.pie = null; }

  if (total === 0) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  State.charts.pie = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['컷트', '염색', '펌', '크리닉'],
      datasets: [{
        data: [cut, color, perm, clinic],
        backgroundColor: ['#A8C5DA','#F2C4CE','#C8DEC8','#E8D8C4'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.raw) + '원 (' +
              Math.round(ctx.raw / total * 100) + '%)'
          }
        }
      }
    }
  });
}

function renderBarChart(dailyTotals) {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  if (State.charts.bar) { State.charts.bar.destroy(); State.charts.bar = null; }

  const hasData = dailyTotals.some(d => d.val > 0);
  if (!hasData) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  // 매출 있는 날만 표시 (최대 31개)
  const labels = dailyTotals.map(d => d.d + '일');
  const values = dailyTotals.map(d => d.val);

  State.charts.bar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: values.map(v => v > 0 ? '#1A1A1A' : '#E8E8E6'),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' ' + fmt(ctx.raw) + '원' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 9 },
            maxRotation: 0,
            callback: (val, i) => dailyTotals[i].val > 0 ? dailyTotals[i].d : ''
          }
        },
        y: {
          grid: { color: '#F0F0EE' },
          ticks: {
            font: { size: 9 },
            callback: v => fmtW(v)
          }
        }
      }
    }
  });
}

function statsPrevMonth() {
  State.statsMonth--;
  if (State.statsMonth < 0) { State.statsMonth = 11; State.statsYear--; }
  renderStats();
}
function statsNextMonth() {
  State.statsMonth++;
  if (State.statsMonth > 11) { State.statsMonth = 0; State.statsYear++; }
  renderStats();
}

/* ══════════════════════════════════════
   SETTINGS PAGE
══════════════════════════════════════ */
function renderSettings() {
  const s = Storage.getSettings();
  document.getElementById('setOwner').value = s.owner || '';
  document.getElementById('setGoal').value  = s.goal  || '';
}

function saveSettings() {
  const owner = document.getElementById('setOwner').value.trim() || '디자이너';
  const goal  = Number(document.getElementById('setGoal').value || 0);
  Storage.setSettings({ owner, goal });
  initHome();
  showToast('설정이 저장되었습니다 ✓');
}

function clearAllData() {
  if (confirm('모든 매출 데이터를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.')) {
    localStorage.removeItem('shieldSales');
    showToast('데이터가 삭제되었습니다');
    renderCalendar();
  }
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed; bottom:calc(var(--nav-h) + 16px + env(safe-area-inset-bottom));
      left:50%; transform:translateX(-50%);
      background:#1A1A1A; color:#fff;
      padding:10px 20px; border-radius:20px;
      font-size:13px; font-weight:600;
      z-index:999; white-space:nowrap;
      transition:opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // 초기 페이지 설정
  document.querySelectorAll('.page-screen').forEach(el => el.style.display = 'none');
  document.getElementById('page-home').style.display = 'block';

  initHome();

  // 모달 외부 클릭 닫기
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // 입력값 변경 시 합계 업데이트
  ['cut','color','perm','clinic'].forEach(id => {
    document.getElementById('inp-' + id).addEventListener('input', updateModalTotal);
  });

  // 서비스워커
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
});


/* ══════════════════════════════════════
   TIMER
══════════════════════════════════════ */
var timerInterval = null;
var timerTotal = 0;
var timerRemain = 0;
var timerRunning = false;

function setTimerMin(min) {
  document.getElementById('timerInput').value = min;
  document.querySelectorAll('.timer-preset-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.textContent) === min);
  });
  timerReset();
}

function timerToggle() {
  if (!timerRunning) {
    var min = parseInt(document.getElementById('timerInput').value) || 0;
    if (min < 1) { document.getElementById('timerStatus').textContent = '시간을 설정해주세요'; return; }
    if (timerRemain === 0) {
      timerTotal = min * 60;
      timerRemain = timerTotal;
    }
    timerRunning = true;
    document.getElementById('timerStartBtn').textContent = '일시정지';
    document.getElementById('timerStatus').textContent = '시술 중...';
    timerInterval = setInterval(timerTick, 1000);
  } else {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerStartBtn').textContent = '재개';
    document.getElementById('timerStatus').textContent = '일시정지됨';
  }
}

function timerTick() {
  timerRemain--;
  timerUpdate();
  if (timerRemain <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerStartBtn').textContent = '시작';
    document.getElementById('timerStatus').textContent = '✅ 시술 완료!';
    // 진동
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    // 알림
    if (Notification && Notification.permission === 'granted') {
      new Notification('쉴드 커넥트', { body: '시술 타이머가 종료되었습니다!' });
    }
  }
}

function timerUpdate() {
  var m = Math.floor(timerRemain / 60);
  var s = timerRemain % 60;
  document.getElementById('timerDisplay').textContent =
    String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  // arc
  var pct = timerTotal > 0 ? timerRemain / timerTotal : 1;
  var circ = 553;
  document.getElementById('timerArc').style.strokeDashoffset = circ * (1 - pct);
}

function timerReset() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRemain = 0;
  document.getElementById('timerDisplay').textContent = '00:00';
  document.getElementById('timerStartBtn').textContent = '시작';
  document.getElementById('timerStatus').textContent = '';
  document.getElementById('timerArc').style.strokeDashoffset = 0;
}

// 알림 권한 요청
if (Notification && Notification.permission === 'default') {
  Notification.requestPermission();
}

/* ══════════════════════════════════════
   MEMO
══════════════════════════════════════ */
function memoSave() {
  var text = (document.getElementById('memoInput').value || '').trim();
  if (!text) return;
  var memos = JSON.parse(localStorage.getItem('shield_memos') || '[]');
  memos.unshift({ id: Date.now(), text: text, date: new Date().toLocaleDateString('ko-KR') });
  localStorage.setItem('shield_memos', JSON.stringify(memos));
  document.getElementById('memoInput').value = '';
  memoRender();
}

function memoDelete(id) {
  var memos = JSON.parse(localStorage.getItem('shield_memos') || '[]');
  memos = memos.filter(function(m) { return m.id !== id; });
  localStorage.setItem('shield_memos', JSON.stringify(memos));
  memoRender();
}

function memoRender() {
  var list = document.getElementById('memoList');
  if (!list) return;
  var memos = JSON.parse(localStorage.getItem('shield_memos') || '[]');
  if (!memos.length) {
    list.innerHTML = '<div class="memo-empty">저장된 메모가 없습니다</div>';
    return;
  }
  list.innerHTML = memos.map(function(m) {
    return '<div class="memo-item">' +
      '<div style="flex:1">' +
        '<div class="memo-item-text">' + m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
        '<div class="memo-item-meta">' + m.date + '</div>' +
      '</div>' +
      '<button class="memo-del-btn" onclick="memoDelete(' + m.id + ')">×</button>' +
    '</div>';
  }).join('');
}


/* ══════════════════════════════════════
   PERM CALCULATOR (펌제 비율 계산기)
══════════════════════════════════════ */
var permState = {
  totalGram: 120,
  roundUnit: 1,
  extraCount: 0
};

function initPermCalc() {
  permState = { totalGram: 120, roundUnit: 1, extraCount: 0 };

  // 총량 버튼
  document.querySelectorAll('.perm-gram-btn').forEach(btn => {
    btn.classList.remove('active');
    if (Number(btn.dataset.gram) === permState.totalGram) btn.classList.add('active');
    btn.onclick = function() {
      document.querySelectorAll('.perm-gram-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      permState.totalGram = Number(this.dataset.gram);
      document.getElementById('perm-custom-input').value = '';
      document.getElementById('perm-selected-gram-display').textContent = permState.totalGram + 'g';
      permCalcUpdate();
    };
  });

  // 직접 입력
  const permCustom = document.getElementById('perm-custom-input');
  if (permCustom) {
    permCustom.oninput = function() {
      const v = parseFloat(this.value);
      if (v > 0) {
        document.querySelectorAll('.perm-gram-btn').forEach(b => b.classList.remove('active'));
        permState.totalGram = v;
        document.getElementById('perm-selected-gram-display').textContent = v + 'g';
        permCalcUpdate();
      }
    };
  }

  // 약제 추가 버튼
  const addColorBtn = document.getElementById('perm-add-color-btn');
  if (addColorBtn) {
    addColorBtn.onclick = function() {
      const list = document.getElementById('perm-color-list');
      const rows = list.querySelectorAll('.color-row');
      if (rows.length >= 3) { alert('최대 3개까지 추가 가능합니다.'); return; }
      const idx = rows.length + 1;
      const row = document.createElement('div');
      row.className = 'color-row';
      row.dataset.idx = idx;
      row.innerHTML = '<div class="color-row-inner">' +
        '<input class="calc-input color-name" type="text" placeholder="예) 중, 약산성펌"/>' +
        '<div class="ratio-wrap"><span class="ratio-sep"></span>' +
        '<input class="calc-input ratio-input" type="number" placeholder="비율" min="0" inputmode="decimal"/></div>' +
        '<button class="color-row-del" onclick="this.closest(".color-row").remove();permCalcUpdate();">✕</button>' +
        '</div>';
      list.appendChild(row);
      row.querySelectorAll('input').forEach(inp => inp.oninput = permCalcUpdate);
    };
  }

  // 기존 행 이벤트
  document.querySelectorAll('#perm-color-list input').forEach(inp => {
    inp.oninput = permCalcUpdate;
  });

  // 추가제품 토글
  const permToggle = document.getElementById('perm-addons-toggle-btn');
  if (permToggle) {
    permToggle.onclick = function() {
      const body = document.getElementById('perm-addons-body');
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    };
  }

  // 추가제품 추가
  const permAddExtra = document.getElementById('perm-add-extra-btn');
  if (permAddExtra) {
    permAddExtra.onclick = function() {
      if (permState.extraCount >= 3) { alert('최대 3개'); return; }
      permState.extraCount++;
      const list = document.getElementById('perm-extra-custom-list');
      const row = document.createElement('div');
      row.className = 'extra-row';
      row.innerHTML = '<div class="color-row-inner">' +
        '<input class="calc-input color-name" type="text" placeholder="제품명 (예: 크리닉)"/>' +
        '<div class="ratio-wrap"><span class="ratio-sep"></span>' +
        '<input class="calc-input ratio-input" type="number" placeholder="%" min="0" inputmode="decimal"/>' +
        '<span class="gram-unit">%</span></div>' +
        '<button class="color-row-del" onclick="this.closest(".extra-row").remove();permState.extraCount--;permCalcUpdate();">✕</button>' +
        '</div>';
      list.appendChild(row);
      row.querySelectorAll('input').forEach(inp => inp.oninput = permCalcUpdate);
    };
  }

  // 반올림 버튼
  document.querySelectorAll('.perm-round-btn').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('.perm-round-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      permState.roundUnit = Number(this.dataset.round);
      permCalcUpdate();
    };
  });

  permCalcUpdate();
}

function permRound(val) {
  const u = permState.roundUnit;
  return Math.round(val / u) * u;
}

function permCalcUpdate() {
  const total = permState.totalGram;
  const rows = document.querySelectorAll('#perm-color-list .color-row');
  const agents = [];
  rows.forEach(row => {
    const name = row.querySelector('.color-name')?.value?.trim() || '';
    const ratio = parseFloat(row.querySelector('.ratio-input')?.value) || 0;
    if (name) agents.push({ name, ratio });
  });

  if (agents.length === 0) {
    document.getElementById('perm-calc-result').innerHTML =
      '<div class="result-empty"><span class="result-empty-icon">💊</span><span>펌제를 입력하면<br>실시간으로 계산됩니다</span></div>';
    return;
  }

  const totalRatio = agents.reduce((a, c) => a + c.ratio, 0);
  let html = '';
  let agentTotalGram = 0;

  agents.forEach((a, i) => {
    const r = totalRatio > 0 ? a.ratio / totalRatio : 1 / agents.length;
    const g = permRound(total * r);
    agentTotalGram += g;
    const pct = Math.round(r * 100);
    html += '<div class="result-row">' +
      '<span class="result-name">' + (a.name || '약제 ' + (i+1)) + '</span>' +
      '<span class="result-gram">' + g + 'g</span>' +
      '<span class="result-pct">(' + pct + '%)</span></div>';
  });

  // 추가제품
  const extraRows = document.querySelectorAll('#perm-extra-custom-list .extra-row');
  if (extraRows.length > 0) {
    html += '<div class="result-divider"></div>';
    extraRows.forEach(row => {
      const name = row.querySelector('.color-name')?.value?.trim() || '추가제품';
      const pct = parseFloat(row.querySelector('.ratio-input')?.value) || 0;
      if (pct > 0 && name) {
        const g = permRound(total * pct / 100);
        html += '<div class="result-row result-row-extra">' +
          '<span class="result-name">+ ' + name + '</span>' +
          '<span class="result-gram">' + g + 'g</span>' +
          '<span class="result-pct">(' + pct + '%)</span></div>';
      }
    });
  }

  // 추가제품 g 합산
  let extraTotalGram = 0;
  extraRows.forEach(row => {
    const pct2 = parseFloat(row.querySelector('.ratio-input')?.value) || 0;
    const name2 = row.querySelector('.color-name')?.value?.trim() || '';
    if (pct2 > 0 && name2) extraTotalGram += permRound(total * pct2 / 100);
  });
  const grandTotal = agentTotalGram + extraTotalGram;
  html += '<div class="result-total-row"><span>펌제</span><span>' + agentTotalGram + 'g</span></div>';
  if (extraTotalGram > 0) {
    html += '<div class="result-total-row" style="color:#888;font-size:13px;"><span>추가제품</span><span>+ ' + extraTotalGram + 'g</span></div>';
    html += '<div class="result-total-row" style="border-top:1.5px solid #ddd;margin-top:4px;padding-top:8px;font-weight:800;font-size:15px;"><span>합계</span><span>' + grandTotal + 'g</span></div>';
  } else {
    html += '<div class="result-total-row" style="font-weight:800;font-size:15px;"><span>합계</span><span>' + agentTotalGram + 'g</span></div>';
  }
  document.getElementById('perm-calc-result').innerHTML = html;
}
