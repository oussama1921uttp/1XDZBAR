/* ==========================================================
   صفحات: السجل، الإيداع، السحب
   ========================================================== */

function historyPage() {
  const rows = S.tx.map((t) => `<tr>
    <td>${esc(t.d)}</td>
    <td>${esc(t.t)}</td>
    <td>${esc(t.amt)}</td>
    <td>${esc(t.note)}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="mu">لا توجد عمليات</td></tr>';

  return `<div class="card">
    <h2>السجل</h2>
    <div class="sc"><table>
      <tr><th>التاريخ</th><th>النوع</th><th>المبلغ $</th><th>تفاصيل</th></tr>
      ${rows}
    </table></div>
  </div>`;
}

function addPage() {
  return `<div class="card">
    <h2>إيداع</h2>
    <p class="mu">محاكاة: لا يتم أي خصم حقيقي، ولا تُحفظ بيانات الوسيلة.</p>
    ${paymentForm()}
    <button class="g" onclick="doMoney(true)">إيداع</button>
  </div>`;
}

function withdrawPage() {
  return `<div class="card">
    <h2>سحب</h2>
    <p class="mu">النقد المتاح: $${f(S.user.bal)}</p>
    ${paymentForm()}
    <button onclick="doMoney(false)">سحب</button>
  </div>`;
}

// isDeposit: true إيداع، false سحب
function doMoney(isDeposit) {
  const u = S.user;
  const amount = parseFloat($('#amt').value);
  const method = $('#m').value;

  if (!(amount > 0)) return toast('أدخل مبلغاً صحيحاً');

  const paymentError = validatePayment(method);
  if (paymentError) return toast(paymentError);

  if (!isDeposit && amount > u.bal) return toast('الرصيد غير كافٍ');

  u.bal += isDeposit ? amount : -amount;
  addTx(isDeposit ? 'إيداع' : 'سحب', (isDeposit ? '+' : '-') + f(amount), method);
  saveUser();

  toast('تمت العملية');
  location.hash = 'history';
}
