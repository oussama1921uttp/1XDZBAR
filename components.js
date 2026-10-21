/* ==========================================================
   مكوّنات خاصة بصفحة التداول (الرسم + البيع والشراء)
   ========================================================== */

/* ---------- الرسم البياني ---------- */
function renderChart(c) {
  const width = 600, height = 220;
  const min = Math.min(...c.h);
  const max = Math.max(...c.h);
  const range = (max - min) || 1;

  const points = c.h.map((v, i) => {
    const x = (i / (c.h.length - 1)) * width;
    const y = height - 8 - ((v - min) / range) * (height - 16);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');

  const color = c.h[c.h.length - 1] >= c.h[0] ? 'var(--up)' : 'var(--dn)';

  return `<svg viewBox="0 0 ${width} ${height}">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------- ملخص مركز المستخدم في عملة ---------- */
function positionStats(c, user) {
  const qty = user.h[c.s] || 0;
  const invested = user.cost[c.s] || 0;
  const value = qty * c.p;
  const pnl = value - invested;
  const pnlText = invested ? (pnl >= 0 ? '+' : '') + f(pnl) : '-';

  return `<div class="stats">
    <div><span class="mu">الكمية المملوكة</span><b>${qty.toFixed(6)} ${c.s}</b></div>
    <div><span class="mu">المبلغ المستثمر</span><b>${fd(invested)}</b></div>
    <div><span class="mu">القيمة الحالية</span><b>${fd(value)}</b></div>
    <div><span class="mu">الربح / الخسارة</span><b class="${pnl >= 0 ? 'up' : 'dn'}">${pnlText}</b></div>
    <div><span class="mu">النقد المتاح</span><b>${fd(user.bal)}</b></div>
  </div>`;
}

/* ---------- بطاقة شراء أو بيع (isBuy: 1 شراء، 0 بيع) ---------- */
function tradeBox(symbol, isBuy) {
  const label = isBuy ? 'شراء' : 'بيع';
  return `<div class="card">
    <h3 class="${isBuy ? 'up' : 'dn'}">${label} ${symbol}</h3>
    <label>المبلغ (DZD) — الحد الأدنى ${MIN_TRADE} DZD</label>
    <input id="amt${isBuy}" type="number" min="${MIN_TRADE}" step="any" placeholder="0">
    <div class="row">
      <button class="l" onclick="fillAmount(${isBuy}, '${symbol}', false)">Min</button>
      <button class="l" onclick="fillAmount(${isBuy}, '${symbol}', true)">Max</button>
    </div>
    <button class="${isBuy ? 'g' : 'r'}" style="width:100%" onclick="doTrade('${symbol}', ${isBuy})">${label}</button>
  </div>`;
}

// تعبئة خانة المبلغ بالحد الأدنى أو الأقصى
function fillAmount(isBuy, symbol, useMax) {
  const c = coin(symbol);
  const available = isBuy ? S.user.bal : (S.user.h[symbol] || 0) * c.p;
  const floored = Math.floor(available * 100) / 100;
  $('#amt' + isBuy).value = useMax ? floored : Math.min(MIN_TRADE, floored);
}
