/* ══════════════════════════════════════
   SHIELD — chart-native.js
   Chart.js 없이 순수 Canvas로 차트 구현
   CDN 의존성 제거 → 오프라인/로컬 완전 동작
══════════════════════════════════════ */

var NativeChart = {

  /* ── 파이(도넛) 차트 ── */
  pie: function(canvasId, labels, values, colors) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var total = values.reduce(function(a, b) { return a + b; }, 0);
    if (total === 0) { canvas.style.display = 'none'; return; }
    canvas.style.display = 'block';

    var dpr = window.devicePixelRatio || 1;
    var size = Math.min(canvas.parentElement.clientWidth, 200);
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    var cx = size / 2, cy = size / 2;
    var outerR = size * 0.44;
    var innerR = size * 0.27;
    var startAngle = -Math.PI / 2;

    values.forEach(function(val, i) {
      if (val === 0) return;
      var slice = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      startAngle += slice;
    });

    /* 도넛 구멍 */
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    /* 중앙 텍스트 */
    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold ' + Math.round(size * 0.1) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total > 0 ? Math.round(values[0] / total * 100) + '%' : '', cx, cy);
  },

  /* ── 바 차트 ── */
  bar: function(canvasId, labels, values, color) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var hasData = values.some(function(v) { return v > 0; });
    if (!hasData) { canvas.style.display = 'none'; return; }
    canvas.style.display = 'block';

    var dpr   = window.devicePixelRatio || 1;
    var w     = canvas.parentElement.clientWidth;
    var h     = 160;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var maxVal = Math.max.apply(null, values) || 1;
    var pad    = { top: 12, right: 8, bottom: 28, left: 44 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top  - pad.bottom;

    /* 배경 그리드 */
    ctx.strokeStyle = '#EEEEEC';
    ctx.lineWidth   = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(function(ratio) {
      var y = pad.top + chartH * (1 - ratio);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
    });

    /* Y축 레이블 */
    ctx.fillStyle    = '#AAAAAA';
    ctx.font         = '9px -apple-system, sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    [0, 0.5, 1].forEach(function(ratio) {
      var y   = pad.top + chartH * (1 - ratio);
      var val = Math.round(maxVal * ratio);
      var label = val >= 10000 ? Math.round(val / 10000) + '만' : val;
      ctx.fillText(label, pad.left - 4, y);
    });

    /* 바 */
    var n      = values.length;
    var barW   = Math.min(Math.floor(chartW / n) - 2, 18);
    var gap    = (chartW - barW * n) / (n + 1);
    var radius = Math.min(3, barW / 2);

    values.forEach(function(val, i) {
      var barH = (val / maxVal) * chartH;
      var x    = pad.left + gap + i * (barW + gap);
      var y    = pad.top + chartH - barH;

      ctx.fillStyle = val > 0 ? color : '#E8E8E6';
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      /* X축 날짜 (매출 있는 날만) */
      if (val > 0 && labels[i]) {
        ctx.fillStyle    = '#999';
        ctx.font         = '8px -apple-system, sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labels[i], x + barW / 2, pad.top + chartH + 4);
      }
    });
  }
};

/* ── Chart.js API 호환 래퍼 (script.js가 new Chart() 를 쓰므로 대체) ── */
function Chart(canvas, config) {
  this._canvas = canvas;
  this._config = config;
  this._draw();
}
Chart.prototype.destroy = function() {
  if (this._canvas) {
    var ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }
};
Chart.prototype._draw = function() {
  var cfg  = this._config;
  var data = cfg.data;
  if (!data || !data.datasets || !data.datasets[0]) return;

  if (cfg.type === 'doughnut') {
    NativeChart.pie(
      this._canvas.id,
      data.labels || [],
      data.datasets[0].data || [],
      data.datasets[0].backgroundColor || ['#ccc']
    );
  } else if (cfg.type === 'bar') {
    NativeChart.bar(
      this._canvas.id,
      data.labels || [],
      data.datasets[0].data || [],
      '#1A1A1A'
    );
  }
};
