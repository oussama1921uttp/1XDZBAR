/* صفحة history.html — طلبات الإيداع والسحب + سجل العمليات */

function historyPage() {
  setTimeout(loadMyRequests, 0);

  const rows = S.tx.map((t) => `<tr>
    <td>${esc(t.d)}</td>
    <td>${esc(t.t)}</td>
    <td>${esc(t.amt)}</td>
    <td>${esc(t.note)}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="mu">لا توجد عمليات</td></tr>';

  return `<div class="card">
    <h2>طلبات الإيداع والسحب</h2>
    <div class="sc" id="rq">جارٍ التحميل...</div>
  </div>

  <div class="card">
    <h2>سجل العمليات</h2>
    <div class="sc"><table>
      <tr><th>التاريخ</th><th>النوع</th><th>المبلغ DZD</th><th>تفاصيل</th></tr>
      ${rows}
    </table></div>
  </div>`;
}

async function loadMyRequests() {
  const snap = await db.ref('requests/' + S.uid).get();
  const list = Object.values(snap.val() || {}).sort((a, b) => b.ts - a.ts);

  const rows = list.map((r) => {
    const [label, cls] = REQUEST_STATUS[r.status] || [r.status, ''];
    return `<tr>
      <td>${esc(r.d)}</td>
      <td>${r.type === 'deposit' ? 'إيداع' : 'سحب'}</td>
      <td>${f(r.amount)}</td>
      <td>${esc(r.method)}</td>
      <td><span class="badge ${cls}">${label}</span>${r.note ? ' <span class="mu">' + esc(r.note) + '</span>' : ''}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="mu">لا توجد طلبات</td></tr>';

  if ($('#rq')) {
    $('#rq').innerHTML = `<table>
      <tr><th>التاريخ</th><th>النوع</th><th>المبلغ DZD</th><th>الوسيلة</th><th>الحالة</th></tr>
      ${rows}
    </table>`;
  }
}

startPage({ key: 'history', access: 'user', render: historyPage });
