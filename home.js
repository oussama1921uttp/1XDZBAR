/* صفحة index.html — الرئيسية وقائمة العملات */

function homePage() {
  const u = S.user;
  const needsDeposit = u.bal <= 0 && !Object.keys(u.h).length;

  const coinRows = COINS.map((c) => {
    const change = (c.p / c.h[0] - 1) * 100;
    return `<div class="coin" onclick="location.href='trade.html?coin=${c.s}'">
      <div><b>${c.s}</b> <span class="mu">${esc(c.n)}</span></div>
      <div style="text-align:left">
        <div id="p-${c.s}">${fd(c.p)}</div>
        <div class="${change >= 0 ? 'up' : 'dn'}" id="c-${c.s}">
          ${change >= 0 ? '▲' : '▼'} ${f(Math.abs(change))}%
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="card hero">
    <div class="mu">أهلاً ${esc(u.name)} — ID: <b style="user-select:all">${esc(u.pid || '...')}</b></div>
    <div class="mu">إجمالي المحفظة</div>
    <div class="big" id="tot">${fd(total(u))}</div>
    <div class="mu">النقد المتاح: ${fd(u.bal)}${needsDeposit ? ' — ابدأ بإيداع رصيد' : ''}</div>
    <div class="row">
      <button class="g" onclick="location.href='add_money.html'">إيداع</button>
      <button onclick="location.href='directing_money.html'">سحب</button>
    </div>
  </div>

  <div class="card">
    <h3>العملات</h3>
    ${coinRows || '<p class="mu">لا توجد عملات حالياً.</p>'}
  </div>`;
}

// تحديث الأسعار الظاهرة
function homeLive() {
  if (!$('#tot')) return;

  COINS.forEach((c) => {
    const priceEl = $('#p-' + c.s);
    if (!priceEl) return;

    const change = (c.p / c.h[0] - 1) * 100;
    const changeEl = $('#c-' + c.s);

    priceEl.textContent = fd(c.p);
    changeEl.className = change >= 0 ? 'up' : 'dn';
    changeEl.textContent = (change >= 0 ? '▲ ' : '▼ ') + f(Math.abs(change)) + '%';
  });

  $('#tot').textContent = fd(total(S.user));
}

startPage({ key: 'home', access: 'user', render: homePage, live: homeLive });
