/* صفحة add_money.html — إيداع (محاكاة) */

function addMoneyPage() {
  return `<div class="card">
    <h2>إيداع</h2>
    <p class="mu">طلب الإيداع يُرسل إلى الإدارة، ويُضاف المبلغ إلى رصيدك بعد الموافقة عليه.</p>
    ${moneyForm()}
    <button class="g" onclick="doMoney(true)">إرسال طلب الإيداع</button>
  </div>`;
}

startPage({ key: 'add_money', access: 'user', render: addMoneyPage });
