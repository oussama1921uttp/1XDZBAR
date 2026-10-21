/* صفحة wallet.html — محفظتي */

function walletPage() {
  const u = S.user;
  const holdings = Object.entries(u.h).filter(([s, q]) => q > 0 && coin(s));
  const totalValue = total(u);

  const rows = holdings.map(([symbol, qty]) => {
    const c = coin(symbol);
    const invested = u.cost[symbol] || 0;
    const value = qty * c.p;
    const pnl = value - invested;

    return `<tr onclick="location.href='trade.html?coin=${symbol}'" style="cursor:pointer">
      <td><b>${symbol}</b></td>
      <td>${qty.toFixed(6)}</td>
      <td>${invested ? fd(invested / qty) : '-'}</td>
      <td>${fd(c.p)}</td>
      <td>${fd(value)}</td>
      <td class="${pnl >= 0 ? 'up' : 'dn'}">${invested ? (pnl >= 0 ? '+' : '') + f(pnl) : '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="mu">لا تملك عملات بعد.</td></tr>';

  const pm = u.pm;

  return `<div class="card">
    <h2>محفظتي</h2>
    <div class="stats">
      <div><span class="mu">ID الحساب</span><b style="user-select:all">${esc(u.pid || '')}</b></div>
      <div><span class="mu">إجمالي المحفظة</span><b>${fd(totalValue)}</b></div>
      <div><span class="mu">النقد</span><b>${fd(u.bal)}</b></div>
      <div><span class="mu">قيمة العملات</span><b>${fd(totalValue - u.bal)}</b></div>
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

startPage({ key: 'wallet', access: 'user', render: walletPage });
