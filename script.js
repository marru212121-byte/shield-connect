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
  if (nav) nav.style.display = (page === 'ingredient' || page === 'reels' || page === 'timer' || page === 'memo' || page === 'feedback') ? 'none' : 'flex';

  if (page === 'sales')      renderCalendar();
  if (page === 'stats')      renderStats();
  if (page === 'settings')   renderSettings();
  if (page === 'ingredient') renderList();
  if (page === 'calculator') { setTimeout(initCalc, 50); }
  if (page === 'reels') { renderReels(); }
  if (page === 'memo') { memoRender(); }
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
  const data    = Storage.getData();
  const k       = dateKey(y, m, d);
  const dayData = data[k] || { cut:0, color:0, perm:0, clinic:0 };

  const days = ['일','월','화','수','목','금','토'];
  const dow  = new Date(y, m, d).getDay();

  document.getElementById('modalTitle').textContent =
    `${m+1}월 ${d}일 (${days[dow]}) 매출 입력`;

  document.getElementById('inp-cut').value    = dayData.cut    || '';
  document.getElementById('inp-color').value  = dayData.color  || '';
  document.getElementById('inp-perm').value   = dayData.perm   || '';
  document.getElementById('inp-clinic').value = dayData.clinic || '';

  updateModalTotal();

  // 저장 버튼
  document.getElementById('modalSaveBtn').onclick = () => saveModal(y, m, d);

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('inp-cut').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function updateModalTotal() {
  const vals = ['cut','color','perm','clinic'].map(
    id => Number(document.getElementById('inp-'+id).value || 0)
  );
  const total = vals.reduce((a,b) => a+b, 0);
  document.getElementById('modalTotalVal').textContent = fmt(total) + '원';
}

function saveModal(y, m, d) {
  const k    = dateKey(y, m, d);
  const data = Storage.getData();

  const cut    = Number(document.getElementById('inp-cut').value    || 0);
  const color  = Number(document.getElementById('inp-color').value  || 0);
  const perm   = Number(document.getElementById('inp-perm').value   || 0);
  const clinic = Number(document.getElementById('inp-clinic').value || 0);

  if (cut + color + perm + clinic === 0) {
    delete data[k];
  } else {
    data[k] = { cut, color, perm, clinic };
  }

  Storage.setData(data);
  closeModal();
  renderCalendar();
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
