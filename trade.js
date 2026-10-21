/* صفحة trade.html?coin=BTC — منحنى العملة والتداول */

const SYMBOL = new URLSearchParams(location.search).get('coin');

function tradePage() {
  const c = coin(SYMBOL);
  if (!c) { location.replace('index.html'); return ''; }

  return `<div class="card">
    <h2>${c.s} <span class="mu">${esc(c.n)}</span></h2>
    <div class="big" id="tp">${fd(c.p)}</div>
    <div id="ch">${renderChart(c)}</div>
    <div id="hold">${positionStats(c, S.user)}</div>
  </div>

  <div class="row2">
    ${tradeBox(SYMBOL, 1)}
    ${tradeBox(SYMBOL, 0)}
  </div>`;
}

// isBuy: 1 شراء، 0 بيع
function doTrade(symbol, isBuy) {
  const u = S.user;
  const c = coin(symbol);
  const amount = parseFloat($('#amt' + isBuy).value);
  const maxAmount = isBuy ? u.bal : (u.h[symbol] || 0) * c.p;

  if (!(amount > 0)) return toast('أدخل مبلغاً صحيحاً');
  if (amount < MIN_TRADE) return toast('الحد الأدنى ' + fd(MIN_TRADE));
  if (amount > maxAmount + 1e-9) return toast('تجاوزت الحد الأقصى ' + fd(maxAmount));

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
  renderPage();
}

// تحديث السعر والمنحنى
function tradeLive() {
  const c = coin(SYMBOL);
  if (!c || !$('#tp')) return;

  $('#tp').textContent = fd(c.p);
  $('#ch').innerHTML = renderChart(c);
  $('#hold').innerHTML = positionStats(c, S.user);
}

startPage({ key: 'trade', access: 'user', render: tradePage, live: tradeLive });
