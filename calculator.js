/* ══════════════════════════════════════
   SHIELD — calculator.js
   염모제 레시피 계산기
══════════════════════════════════════ */

var CalcState = {
  totalGram:   120,
  roundMode:   1,      // 1 = 1g 반올림, 0.5 = 0.5g 반올림
  oxiRatio:    1,      // 1,2,3 → 1:1, 1:2, 1:3
  extras:      [],     // { id, name, pct, enabled }
  extraIdSeed: 0,
  addonsOpen:  false
};

/* ── 초기화 ── */
function initCalc() {
  /* 첫 번째 color-row input 이벤트 바인딩 */
  document.querySelectorAll('#color-list .color-row input').forEach(function(el) {
    el.addEventListener('input', calcRender);
  });
  /* gram-btn 두 번째(미디움) 기본 active 보정 */
  var btns = document.querySelectorAll('.gram-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  /* 60g → 미디움이 실제로는 60g이어야 하므로 60 active */
  var defaultBtn = document.querySelector('.gram-btn[data-gram="120"]');
  if (defaultBtn) defaultBtn.classList.add('active');
  calcBindEvents();
  calcRender();
}

/* ── 이벤트 바인딩 ── */
function calcBindEvents() {
  /* 총량 프리셋 버튼 */
  document.querySelectorAll('.gram-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var g = parseInt(btn.dataset.gram);
      CalcState.totalGram = g;
      document.getElementById('calc-custom-input').value = '';
      document.querySelectorAll('.gram-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      calcRender();
    });
  });

  /* 직접 입력 */
  document.getElementById('calc-custom-input').addEventListener('input', function() {
    var v = parseFloat(this.value);
    if (v > 0) {
      CalcState.totalGram = v;
      document.querySelectorAll('.gram-btn').forEach(function(b) { b.classList.remove('active'); });
      calcRender();
    }
  });

  /* 반올림 옵션 */
  document.querySelectorAll('.round-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      CalcState.roundMode = parseFloat(btn.dataset.round);
      document.querySelectorAll('.round-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      calcRender();
    });
  });

  /* 산화제 비율 */
  document.querySelectorAll('.oxi-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      CalcState.oxiRatio = parseFloat(btn.dataset.oxi);
      document.querySelectorAll('.oxi-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      calcRender();
    });
  });

  /* 염모제 추가 버튼 */
  document.getElementById('add-color-btn').addEventListener('click', addColorRow);

  /* 추가 제품 토글 */
  document.getElementById('addons-toggle-btn').addEventListener('click', toggleAddons);

  /* 추가 제품 항목 추가 */
  document.getElementById('add-extra-btn').addEventListener('click', addExtraRow);

  /* 기본 추가제품 없음 - 커스텀만 사용 */

  /* 체크박스 없음 */

}

/* ── 염모제 행 추가 ── */
function addColorRow() {
  var list = document.getElementById('color-list');
  var rows = list.querySelectorAll('.color-row');
  if (rows.length >= 3) {
    showToast('염모제는 최대 3개까지 입력할 수 있습니다');
    return;
  }
  var idx = rows.length + 1;
  var row = document.createElement('div');
  row.className = 'color-row';
  row.dataset.idx = idx;
  row.innerHTML =
    '<div class="color-row-inner">' +
      '<input class="calc-input color-name" type="text" placeholder="염모제 ' + idx + ' 이름" />' +
      '<div class="ratio-wrap">' +
        '<span class="ratio-sep">' + (idx > 1 ? ':' : '') + '</span>' +
        '<input class="calc-input ratio-input" type="number" placeholder="비율" min="0" inputmode="decimal" />' +
      '</div>' +
      '<button class="remove-row-btn" onclick="removeColorRow(this)">×</button>' +
    '</div>';
  row.querySelectorAll('input').forEach(function(el) { el.addEventListener('input', calcRender); });
  list.appendChild(row);
  calcRender();
}

function removeColorRow(btn) {
  btn.closest('.color-row').remove();
  reindexColorRows();
  calcRender();
}

function reindexColorRows() {
  document.querySelectorAll('#color-list .color-row').forEach(function(row, i) {
    var nameInput = row.querySelector('.color-name');
    nameInput.placeholder = '염모제 ' + (i+1) + ' 이름';
    var sep = row.querySelector('.ratio-sep');
    if (sep) sep.textContent = i > 0 ? ':' : '';
  });
}

/* ── 추가제품 토글 ── */
function toggleAddons() {
  CalcState.addonsOpen = !CalcState.addonsOpen;
  var body = document.getElementById('addons-body');
  var btn  = document.getElementById('addons-toggle-btn');
  body.style.display  = CalcState.addonsOpen ? 'block' : 'none';
  btn.textContent     = CalcState.addonsOpen ? '− 추가 제품 닫기' : '+ 추가 제품';
  calcRender();
}

/* ── 커스텀 추가제품 행 추가 (최대 2개) ── */
function addExtraRow() {
  if (CalcState.extras.length >= 3) {
    showToast('추가 제품은 최대 3개까지 가능합니다');
    return;
  }
  CalcState.extraIdSeed++;
  var id = 'extra-' + CalcState.extraIdSeed;
  CalcState.extras.push({ id: id, name: '', pct: '', enabled: true });

  var list = document.getElementById('extra-custom-list');
  var row = document.createElement('div');
  row.className = 'extra-row';
  row.id = 'row-' + id;
  row.innerHTML =
    '<input class="calc-input extra-name" type="text" placeholder="제품명" data-id="' + id + '" />' +
    '<div class="extra-pct-wrap">' +
      '<input class="calc-input extra-pct" type="number" placeholder="%" min="0" max="999" inputmode="decimal" data-id="' + id + '" />' +
      '<span class="pct-label">%</span>' +
    '</div>' +
    '<button class="remove-row-btn" onclick="removeExtraRow(\'' + id + '\')">×</button>';

  row.querySelector('.extra-name').addEventListener('input', function() {
    var item = CalcState.extras.find(function(e) { return e.id === id; });
    if (item) item.name = this.value;
    calcRender();
  });
  row.querySelector('.extra-pct').addEventListener('input', function() {
    var item = CalcState.extras.find(function(e) { return e.id === id; });
    if (item) item.pct = this.value;
    calcRender();
  });

  list.appendChild(row);
  calcRender();
}

function removeExtraRow(id) {
  CalcState.extras = CalcState.extras.filter(function(e) { return e.id !== id; });
  var row = document.getElementById('row-' + id);
  if (row) row.remove();
  calcRender();
}

/* ── 반올림 ── */
function rnd(val) {
  var m = CalcState.roundMode;
  return Math.round(val / m) * m;
}

/* ── 메인 계산 + 렌더 ── */
function calcRender() {
  var total = CalcState.totalGram;

  /* 선택 총량 표시 */
  document.getElementById('selected-gram-display').textContent = total + 'g';

  /* 염모제 rows 읽기 */
  var colorRows = document.querySelectorAll('#color-list .color-row');
  var colors = [];
  colorRows.forEach(function(row) {
    var name  = (row.querySelector('.color-name').value || '').trim();
    var ratio = parseFloat(row.querySelector('.ratio-input').value) || 0;
    if (name !== '' || ratio > 0) {
      colors.push({ name: name || '염모제', ratio: ratio });
    }
  });

  /* 비율 합 */
  var ratioSum = colors.reduce(function(s, c) { return s + c.ratio; }, 0);
  /* 비율 미입력 → 동일 비율 */
  if (ratioSum === 0 && colors.length > 0) {
    colors.forEach(function(c) { c.ratio = 1; });
    ratioSum = colors.length;
  }

  /* 염모제 계산 */
  colors.forEach(function(c) {
    c.gram = colors.length === 1 ? total : rnd((c.ratio / ratioSum) * total);
  });
  var mainTotal = colors.reduce(function(s, c) { return s + c.gram; }, 0);

  /* 추가제품 계산 */
  var extraItems = [];

  /* 기본 추가제품 없음 */

  /* 커스텀 추가제품 */
  CalcState.extras.forEach(function(e) {
    var pct = parseFloat(e.pct) || 0;
    if (pct > 0) {
      extraItems.push({ name: e.name || '추가제품', pct: pct, gram: rnd(mainTotal * pct / 100) });
    }
  });

  var extraTotal   = extraItems.reduce(function(s, e) { return s + e.gram; }, 0);
  var allColorTotal= mainTotal + extraTotal;
  var oxiGram      = rnd(allColorTotal * CalcState.oxiRatio);
  var grandTotal   = allColorTotal + oxiGram;

  /* ── 추가제품 안내 문구 실시간 업데이트 ── */
  var noteEl = document.getElementById('addons-note-text');
  if (noteEl) {
    if (mainTotal > 0) {
      noteEl.innerHTML =
        '컨트롤컬러, 클리어, 앰플/본드 등 추가 제품의<br>' +
        '제품명과 비율(%)을 입력하세요<br><br>' +
        '<strong style="font-size:15px;color:#1A1814">기준량 : ' + mainTotal + 'g</strong><br>' +
        '<span class="addons-note-example">10% = ' + rnd(mainTotal * 0.1) + 'g &nbsp;·&nbsp; 20% = ' + rnd(mainTotal * 0.2) + 'g &nbsp;·&nbsp; 30% = ' + rnd(mainTotal * 0.3) + 'g</span>';
    } else {
      noteEl.innerHTML =
        '컨트롤컬러, 클리어, 앰플/본드 등 추가 제품의<br>' +
        '제품명과 비율(%)을 입력하세요<br>' +
        '<span class="addons-note-example">염모제를 먼저 입력하면 기준량이 표시됩니다</span>';
    }
  }

  /* ── 결과 렌더 ── */
  var res = document.getElementById('calc-result');

  if (colors.length === 0) {
    res.innerHTML =
      '<div class="result-empty">' +
        '<span class="result-empty-icon">🎨</span>' +
        '<span>염모제를 입력하면<br>실시간으로 계산됩니다</span>' +
      '</div>';
    return;
  }

  var html = '';

  /* 염모제 비율 표시 */
  html += '<div class="result-section">';
  html += '<div class="result-sec-label">염모제</div>';

  if (colors.length === 1) {
    html +=
      '<div class="result-main-row">' +
        '<span class="result-name">' + esc(colors[0].name) + '</span>' +
        '<span class="result-gram">' + colors[0].gram + 'g</span>' +
      '</div>';
  } else {
    /* 비율 흐름 표시 */
    var ratioStr = colors.map(function(c) { return c.ratio; }).join(' : ');
    var gramStr  = colors.map(function(c) { return c.gram + 'g'; }).join(' : ');
    html +=
      '<div class="result-ratio-flow">' +
        '<span class="result-ratio-label">' +
          colors.map(function(c) { return esc(c.name); }).join(' : ') +
        '</span>' +
        '<span class="result-ratio-eq">= ' + ratioStr + '</span>' +
      '</div>';
    colors.forEach(function(c) {
      html +=
        '<div class="result-main-row">' +
          '<span class="result-name">' + esc(c.name) + '</span>' +
          '<span class="result-gram">' + c.gram + 'g</span>' +
        '</div>';
    });
  }

  html +=
    '<div class="result-sub-row">' +
      '<span class="result-sub-label">메인 염모제 합계</span>' +
      '<span class="result-sub-gram">' + mainTotal + 'g</span>' +
    '</div>';
  html += '</div>';

  /* 추가제품 */
  if (extraItems.length > 0) {
    html += '<div class="result-section">';
    html += '<div class="result-sec-label">추가 제품</div>';
  html += '<div class="result-extra-basis">메인 염모제 <strong>' + mainTotal + 'g</strong> 기준 · %당 <strong>' + rnd(mainTotal * 0.01) + 'g</strong></div>';
    extraItems.forEach(function(e) {
      html +=
        '<div class="result-main-row">' +
          '<span class="result-name">' + esc(e.name) + ' <span class="result-pct">(' + e.pct + '%)</span></span>' +
          '<span class="result-gram">' + e.gram + 'g</span>' +
        '</div>';
    });
    html +=
      '<div class="result-sub-row">' +
        '<span class="result-sub-label">추가 제품 합계</span>' +
        '<span class="result-sub-gram">' + extraTotal + 'g</span>' +
      '</div>';
    html += '</div>';
  }

  /* 전체 염모제 + 산화제 */
  html += '<div class="result-section result-section-total">';

  /* 염모제 총 사용량 강조 박스 */
  html +=
    '<div class="result-color-total-box">' +
      '<span class="result-color-total-label">염모제 총 사용량</span>' +
      '<span class="result-color-total-gram">' + allColorTotal + 'g</span>' +
    '</div>';

  /* 산화제 */
  html +=
    '<div class="result-total-row" style="margin-top:8px;">' +
      '<span>산화제 (1 : ' + CalcState.oxiRatio + ')</span>' +
      '<span class="result-total-gram">' + oxiGram + 'g</span>' +
    '</div>';

  html += '<div class="result-divider"></div>';

  /* 염모제 + 산화제 총 사용량 */
  html +=
    '<div class="result-grand-row">' +
      '<div class="result-grand-label-wrap">' +
        '<span class="result-grand-title">염모제 + 산화제</span>' +
        '<span class="result-grand-sub">총 사용량</span>' +
      '</div>' +
      '<span class="result-grand-gram">' + grandTotal + 'g</span>' +
    '</div>';

  html += '</div>';

  res.innerHTML = html;
}

/* ── 유틸 ── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
