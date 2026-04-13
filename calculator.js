/* ══════════════════════════════════════
   SHIELD — calculator.js  (v3 — 바울 카드)
   염모제 레시피 계산기
══════════════════════════════════════ */

var CalcState = {
  totalGram:   120,
  roundMode:   1,
  oxiRatio:    1,
  bowls:       [],
  bowlIdSeed:  0,
  extraIdSeed: 0,
  maxBowls:    3,
  maxExtras:   3
};

/* ── 초기화 ── */
function initCalc() {
  CalcState.bowlIdSeed = 1;
  CalcState.bowls = [{ id: 1, extras: [] }];
  bindBowlInputs(1);
  calcBindGlobal();
  calcRenderAll();
}

/* ── 글로벌 이벤트 ── */
function calcBindGlobal() {
  document.querySelectorAll('.gram-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var g = parseInt(btn.dataset.gram);
      CalcState.totalGram = g;
      document.getElementById('calc-custom-input').value = '';
      document.querySelectorAll('.gram-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      calcRenderAll();
    });
  });

  document.getElementById('calc-custom-input').addEventListener('input', function() {
    var v = parseFloat(this.value);
    if (v > 0) {
      CalcState.totalGram = v;
      document.querySelectorAll('.gram-btn').forEach(function(b) { b.classList.remove('active'); });
      calcRenderAll();
    }
  });

  document.querySelectorAll('.round-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      CalcState.roundMode = parseFloat(btn.dataset.round);
      document.querySelectorAll('.round-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      calcRenderAll();
    });
  });

  document.querySelectorAll('.oxi-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      CalcState.oxiRatio = parseFloat(btn.dataset.oxi);
      document.querySelectorAll('.oxi-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      calcRenderAll();
    });
  });

  document.getElementById('bowl-1-add-extra').addEventListener('click', function() {
    addBowlExtra(1);
  });

  document.getElementById('add-bowl-btn').addEventListener('click', addBowl);
}

/* ── 바울 input 바인딩 ── */
function bindBowlInputs(bowlId) {
  var card = document.getElementById('bowl-' + bowlId);
  if (!card) return;
  card.querySelectorAll('.bowl-color-name, .bowl-ratio-input').forEach(function(el) {
    el.addEventListener('input', calcRenderAll);
  });
}

/* ── 바울 추가 ── */
function addBowl() {
  if (CalcState.bowls.length >= CalcState.maxBowls) {
    showToast('바울은 최대 ' + CalcState.maxBowls + '개까지 가능합니다');
    return;
  }
  CalcState.bowlIdSeed++;
  var bowlId = CalcState.bowlIdSeed;
  var bowlNum = CalcState.bowls.length + 1;
  CalcState.bowls.push({ id: bowlId, extras: [] });

  var html =
    '<div class="bowl-card" id="bowl-' + bowlId + '">' +
      '<div class="bowl-header">' +
        '<div class="bowl-number">' + bowlNum + '</div>' +
        '<span class="bowl-title">바울 ' + bowlNum + '</span>' +
        '<span class="bowl-summary" id="bowl-' + bowlId + '-summary"></span>' +
        '<button class="bowl-remove-btn" onclick="removeBowl(' + bowlId + ')">삭제</button>' +
      '</div>' +
      '<div class="bowl-color-list" id="bowl-' + bowlId + '-colors">' +
        bowlColorRowHTML(bowlId, 1, '') +
        bowlColorRowHTML(bowlId, 2, ':') +
        bowlColorRowHTML(bowlId, 3, ':') +
      '</div>' +
      '<div class="bowl-extras-section" id="bowl-' + bowlId + '-extras-section" style="display:none;">' +
        '<div class="bowl-extras-divider"></div>' +
        '<div class="bowl-extras-label">추가제 (염모제 총량 기준 %)</div>' +
        '<div class="bowl-extras-list" id="bowl-' + bowlId + '-extras-list"></div>' +
      '</div>' +
      '<button class="bowl-add-extra-btn" id="bowl-' + bowlId + '-add-extra" onclick="addBowlExtra(' + bowlId + ')">+ 추가</button>' +
      '<div class="bowl-total-bar" id="bowl-' + bowlId + '-total">' +
        '<span class="bowl-total-text">염모제를 입력하세요</span>' +
      '</div>' +
    '</div>';

  var addBtn = document.getElementById('add-bowl-btn');
  addBtn.insertAdjacentHTML('beforebegin', html);
  bindBowlInputs(bowlId);
  updateAddBowlBtn();
  calcRenderAll();
}

function bowlColorRowHTML(bowlId, num, sep) {
  return '<div class="bowl-color-row">' +
    '<input class="calc-input bowl-color-name" type="text" placeholder="염모제 ' + num + '" data-bowl="' + bowlId + '"/>' +
    '<div class="bowl-ratio-wrap">' +
      (sep ? '<span class="bowl-ratio-sep">' + sep + '</span>' : '') +
      '<input class="calc-input bowl-ratio-input" type="number" placeholder="비율" min="0" inputmode="decimal" data-bowl="' + bowlId + '"/>' +
    '</div>' +
    '<span class="bowl-color-gram" data-bowl="' + bowlId + '">—</span>' +
  '</div>';
}

/* ── 바울 삭제 ── */
function removeBowl(bowlId) {
  CalcState.bowls = CalcState.bowls.filter(function(b) { return b.id !== bowlId; });
  var el = document.getElementById('bowl-' + bowlId);
  if (el) el.remove();
  reindexBowls();
  updateAddBowlBtn();
  calcRenderAll();
}

function reindexBowls() {
  document.querySelectorAll('.bowl-card').forEach(function(card, i) {
    var num = card.querySelector('.bowl-number');
    var title = card.querySelector('.bowl-title');
    if (num) num.textContent = i + 1;
    if (title) title.textContent = '바울 ' + (i + 1);
  });
}

function updateAddBowlBtn() {
  var btn = document.getElementById('add-bowl-btn');
  if (CalcState.bowls.length >= CalcState.maxBowls) {
    btn.style.display = 'none';
  } else {
    btn.style.display = 'block';
    btn.textContent = '+ 바울 ' + (CalcState.bowls.length + 1) + ' 추가';
  }
}

/* ── 추가제 추가 ── */
function addBowlExtra(bowlId) {
  var bowl = CalcState.bowls.find(function(b) { return b.id === bowlId; });
  if (!bowl) return;
  if (bowl.extras.length >= CalcState.maxExtras) {
    showToast('추가 제품은 바울당 최대 ' + CalcState.maxExtras + '개까지 가능합니다');
    return;
  }

  CalcState.extraIdSeed++;
  var eid = 'ext-' + CalcState.extraIdSeed;
  bowl.extras.push({ id: eid, name: '', pct: '', includeInOxi: false });

  var section = document.getElementById('bowl-' + bowlId + '-extras-section');
  section.style.display = 'block';

  var list = document.getElementById('bowl-' + bowlId + '-extras-list');
  var row = document.createElement('div');
  row.className = 'bowl-extra-row';
  row.id = 'row-' + eid;
  row.innerHTML =
    '<div class="bowl-extra-row-top">' +
      '<input class="calc-input bowl-extra-name" type="text" placeholder="제품명" data-eid="' + eid + '"/>' +
      '<div class="bowl-extra-pct-wrap">' +
        '<input class="calc-input bowl-extra-pct" type="number" placeholder="%" min="0" max="999" inputmode="decimal" data-eid="' + eid + '"/>' +
        '<span class="bowl-extra-pct-label">%</span>' +
      '</div>' +
      '<span class="bowl-extra-gram" id="gram-' + eid + '">—</span>' +
      '<button class="bowl-extra-remove" onclick="removeBowlExtra(' + bowlId + ',\'' + eid + '\')">×</button>' +
    '</div>' +
    '<label class="bowl-oxi-include-label">' +
      '<input type="checkbox" class="bowl-oxi-include-chk" data-eid="' + eid + '"/>' +
      '<span class="bowl-oxi-include-text">산화제 비율에 포함</span>' +
    '</label>';

  row.querySelector('.bowl-extra-name').addEventListener('input', function() {
    var item = bowl.extras.find(function(e) { return e.id === eid; });
    if (item) item.name = this.value;
    calcRenderAll();
  });
  row.querySelector('.bowl-extra-pct').addEventListener('input', function() {
    var item = bowl.extras.find(function(e) { return e.id === eid; });
    if (item) item.pct = this.value;
    calcRenderAll();
  });
  row.querySelector('.bowl-oxi-include-chk').addEventListener('change', function() {
    var item = bowl.extras.find(function(e) { return e.id === eid; });
    if (item) item.includeInOxi = this.checked;
    calcRenderAll();
  });

  list.appendChild(row);
  calcRenderAll();
}

/* ── 추가제 삭제 ── */
function removeBowlExtra(bowlId, eid) {
  var bowl = CalcState.bowls.find(function(b) { return b.id === bowlId; });
  if (!bowl) return;
  bowl.extras = bowl.extras.filter(function(e) { return e.id !== eid; });
  var row = document.getElementById('row-' + eid);
  if (row) row.remove();
  if (bowl.extras.length === 0) {
    var section = document.getElementById('bowl-' + bowlId + '-extras-section');
    if (section) section.style.display = 'none';
  }
  calcRenderAll();
}

/* ── 반올림 ── */
function rnd(val) {
  var m = CalcState.roundMode;
  return Math.round(val / m) * m;
}

/* ── 전체 렌더 ── */
function calcRenderAll() {
  CalcState.bowls.forEach(function(bowl) {
    calcRenderBowl(bowl);
  });
}

/* ── 개별 바울 계산 ── */
function calcRenderBowl(bowl) {
  var total = CalcState.totalGram;
  var bowlId = bowl.id;
  var card = document.getElementById('bowl-' + bowlId);
  if (!card) return;

  var rows = card.querySelectorAll('.bowl-color-row');
  var colors = [];
  var gramSpans = card.querySelectorAll('.bowl-color-gram');

  rows.forEach(function(row, i) {
    var name  = (row.querySelector('.bowl-color-name').value || '').trim();
    var ratio = parseFloat(row.querySelector('.bowl-ratio-input').value) || 0;
    colors.push({ name: name, ratio: ratio, idx: i });
  });

  var active = colors.filter(function(c) { return c.name !== '' || c.ratio > 0; });
  var ratioSum = active.reduce(function(s, c) { return s + c.ratio; }, 0);
  if (ratioSum === 0 && active.length > 0) {
    active.forEach(function(c) { c.ratio = 1; });
    ratioSum = active.length;
  }

  var colorGrams = {};
  active.forEach(function(c) {
    c.gram = active.length === 1 ? total : rnd((c.ratio / ratioSum) * total);
    colorGrams[c.idx] = c.gram;
  });
  var mainTotal = active.reduce(function(s, c) { return s + c.gram; }, 0);

  gramSpans.forEach(function(span, i) {
    if (colorGrams[i] !== undefined) {
      span.textContent = colorGrams[i] + 'g';
      span.style.color = '#1A1814';
    } else {
      span.textContent = '—';
      span.style.color = '#ccc';
    }
  });

  /* 추가제 */
  var extraItems = [];
  bowl.extras.forEach(function(e) {
    var pct = parseFloat(e.pct) || 0;
    var gram = pct > 0 ? rnd(mainTotal * pct / 100) : 0;
    extraItems.push({ id: e.id, pct: pct, gram: gram, includeInOxi: e.includeInOxi });
    var gEl = document.getElementById('gram-' + e.id);
    if (gEl) gEl.textContent = pct > 0 ? gram + 'g' : '—';
  });

  var extraTotal = extraItems.reduce(function(s, e) { return s + e.gram; }, 0);

  /* 산화제 */
  var oxiBase = mainTotal;
  extraItems.forEach(function(e) {
    if (e.includeInOxi) oxiBase += e.gram;
  });
  var oxiGram = rnd(oxiBase * CalcState.oxiRatio);
  var grandTotal = mainTotal + oxiGram + extraTotal;

  /* 요약 */
  var summaryEl = document.getElementById('bowl-' + bowlId + '-summary');
  if (summaryEl) {
    summaryEl.textContent = active.length > 0
      ? '염모제 ' + mainTotal + 'g + 산화제 ' + oxiGram + 'g'
      : '';
  }

  /* 합계 바 */
  var totalBar = document.getElementById('bowl-' + bowlId + '-total');
  if (active.length === 0) {
    totalBar.innerHTML = '<span class="bowl-total-text">염모제를 입력하세요</span>';
    return;
  }

  var bowlIdx = CalcState.bowls.indexOf(bowl) + 1;
  var parts = '염모제 ' + mainTotal + 'g &nbsp;+&nbsp; 산화제 ' + oxiGram + 'g';
  if (extraTotal > 0) parts += ' &nbsp;+&nbsp; 추가 ' + extraTotal + 'g';

  totalBar.innerHTML =
    '<div class="bowl-total-detail">' +
      '<span style="font-size:12px;color:#888;font-weight:400;">바울 ' + bowlIdx + ' 합계</span><br>' +
      '<span style="font-size:13px;">' + parts + ' &nbsp;=</span>' +
      '<span class="bowl-total-grand">' + grandTotal + 'g</span>' +
    '</div>';
}

/* ── 유틸 ── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
