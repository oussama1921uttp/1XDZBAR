/* ==========================================================
   صفحات: الرئيسية، التداول، محفظتي
   ========================================================== */

/* ---------- الرئيسية ---------- */
function homePage() {
  const u = S.user;
  const needsDeposit = u.bal <= 0 && !Object.keys(u.h).length;

  const coinRows = COINS.map((c) => {
    const change = (c.p / c.h[0] - 1) * 100;
    return `<div class="coin" onclick="location.hash='trade/${c.s}'">
      <div><b>${c.s}</b> <span class="mu">${esc(c.n)}</span></div>
      <div style="text-align:left">
        <div id="p-${c.s}">$${f(c.p)}</div>
        <div class="${change >= 0 ? 'up' : 'dn'}" id="c-${c.s}">
          ${change >= 0 ? '▲' : '▼'} ${f(Math.abs(change))}%
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="card">
    <div class="mu">أهلاً ${esc(u.name)} — إجمالي المحفظة</div>
    <div class="big" id="tot">$${f(total(u))}</div>
    <div class="mu">النقد المتاح: $${f(u.bal)}${needsDeposit ? ' — ابدأ بإيداع رصيد' : ''}</div>
    <div class="row">
      <button class="g" onclick="location.hash='add'">إيداع</button>
      <button onclick="location.hash='withdraw'">سحب</button>
    </div>
  </div>

  <div class="card">
    <h3>العملات</h3>
    ${coinRows}
  </div>`;
}

/* ---------- صفحة التداول ---------- */
function tradePage(symbol) {
  const c = coin(symbol);
  if (!c) { location.hash = 'home'; return ''; }

  return `<div class="card">
    <h2>${c.s} <span class="mu">${esc(c.n)}</span></h2>
    <div class="big" id="tp">$${f(c.p)}</div>
    <div id="ch">${renderChart(c)}</div>
    <div id="hold">${positionStats(c, S.user)}</div>
  </div>

  <div class="row2">
    ${tradeBox(symbol, 1)}
    ${tradeBox(symbol, 0)}
  </div>`;
}

// isBuy: 1 شراء، 0 بيع
function doTrade(symbol, isBuy) {
  const u = S.user;
  const c = coin(symbol);
  const amount = parseFloat($('#amt' + isBuy).value);
  const maxAmount = isBuy ? u.bal : (u.h[symbol] || 0) * c.p;

  if (!(amount > 0)) return toast('أدخل مبلغاً صحيحاً');
  if (amount < MIN_TRADE) return toast('الحد الأدنى $' + MIN_TRADE);
  if (amount > maxAmount + 1e-9) return toast('تجاوزت الحد الأقصى $' + f(maxAmount));

  let qty;

  if (isBuy) {
    qty = amount / c.p;
    u.bal -= amount;
    u.h[symbol] = (u.h[symbol] || 0) + qty;
    u.cost[symbol] = (u.cost[symbol] || 0) + amount;
    addTx('شراء', '-' + f(amount), `${symbol} بسعر ${f(c.p)}`);
  } else {
    const owned = u.h[symbol] || 0;
    qty = amount >= maxAmount - 0.01 ? owned : amount / c.p;   // بيع كل الكمية عند Max

    // تخفيض التكلفة بنسبة ما بيع
    u.cost[symbol] = owned > 0 ? (u.cost[symbol] || 0) * Math.max(0, 1 - qty / owned) : 0;
    u.h[symbol] = Math.max(0, owned - qty);
    if (u.h[symbol] < 1e-9) { u.h[symbol] = 0; u.cost[symbol] = 0; }

    u.bal += amount;
    addTx('بيع', '+' + f(amount), `${symbol} بسعر ${f(c.p)}`);
  }

  saveUser();
  toast(`${isBuy ? 'تم شراء' : 'تم بيع'} ${qty.toFixed(6)} ${symbol}`);
  route();
}

/* ---------- محفظتي ---------- */
function walletPage() {
  const u = S.user;
  const holdings = Object.entries(u.h).filter(([s, q]) => q > 0 && coin(s));
  const totalValue = total(u);

  const rows = holdings.map(([symbol, qty]) => {
    const c = coin(symbol);
    const invested = u.cost[symbol] || 0;
    const value = qty * c.p;
    const pnl = value - invested;

    return `<tr onclick="location.hash='trade/${symbol}'" style="cursor:pointer">
      <td><b>${symbol}</b></td>
      <td>${qty.toFixed(6)}</td>
      <td>${invested ? '$' + f(invested / qty) : '-'}</td>
      <td>$${f(c.p)}</td>
      <td>$${f(value)}</td>
      <td class="${pnl >= 0 ? 'up' : 'dn'}">${invested ? (pnl >= 0 ? '+' : '') + f(pnl) : '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="mu">لا تملك عملات بعد.</td></tr>';

  const pm = u.pm;

  return `<div class="card">
    <h2>محفظتي</h2>
    <div class="stats">
      <div><span class="mu">إجمالي المحفظة</span><b>$${f(totalValue)}</b></div>
      <div><span class="mu">النقد</span><b>$${f(u.bal)}</b></div>
      <div><span class="mu">قيمة العملات</span><b>$${f(totalValue - u.bal)}</b></div>
    </div>
  </div>

  <div class="card">
    <h3>أصولي</h3>
    <div class="sc"><table>
      <tr><th>العملة</th><th>الكمية</th><th>متوسط الشراء</th><th>السعر الحالي</th><th>القيمة</th><th>ربح/خسارة</th></tr>
      ${rows}
    </table></div>
  </div>

  <div class="card">
    <h3>وسيلة الدفع المسجّلة</h3>
    ${pm ? `<p>${esc(pm.t)} — ${esc(pm.h)} — ${esc(pm.k)}</p>` : '<p class="mu">لا توجد</p>'}
  </div>`;
}
