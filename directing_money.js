/* صفحة directing_money.html — سحب (محاكاة) */

function directingMoneyPage() {
  return `<div class="card">
    <h2>سحب</h2>
    <p class="mu">طلب السحب يُرسل إلى الإدارة، ويُخصم المبلغ من رصيدك بعد الموافقة عليه ${fd(S.user.bal)}</p>
    ${moneyForm()}
    <button onclick="doMoney(false)">إرسال طلب السحب</button>
  </div>`;
}

startPage({ key: 'directing_money', access: 'user', render: directingMoneyPage });
