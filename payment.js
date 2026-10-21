/* ==========================================================
   وسائل الدفع (Dahab / Baridi) — مشتركة بين:
   التسجيل، الإيداع، السحب
   ========================================================== */

// حقول الوسيلة المختارة
function paymentFields(method) {
  const nameRow = `<div class="row">
    <div><label>الاسم</label><input id="fn"></div>
    <div><label>اللقب</label><input id="ln"></div>
  </div>`;

  if (method === 'Baridi') {
    return nameRow + `
      <label>RIP (20 رقماً)</label>
      <input id="rip" inputmode="numeric" maxlength="20">`;
  }

  return nameRow + `
    <label>رقم البطاقة (16 رقماً)</label>
    <input id="cn" inputmode="numeric" maxlength="19">
    <div class="row">
      <div><label>تاريخ الانتهاء</label><input id="ex" maxlength="5" placeholder="MM/YY"></div>
      <div><label>رمز CVV</label><input id="cv" inputmode="numeric" maxlength="3"></div>
    </div>`;
}

// تبديل الحقول عند تغيير الوسيلة
function changeMethod() {
  $('#mf').innerHTML = paymentFields($('#m').value);
}

// التحقق من حقول الدفع. يرجع نص الخطأ أو '' إذا كان كل شيء سليماً
function validatePayment(method) {
  const val = (id) => ($('#' + id).value || '').trim();

  if (!val('fn') || !val('ln')) return 'أدخل الاسم واللقب';

  if (method === 'Baridi') {
    return /^\d{20}$/.test(val('rip')) ? '' : 'RIP يجب أن يكون 20 رقماً';
  }

  if (!/^\d{16}$/.test(val('cn').replace(/\s/g, ''))) return 'رقم البطاقة يجب أن يكون 16 رقماً';
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(val('ex'))) return 'تاريخ الانتهاء بصيغة MM/YY';
  if (!/^\d{3}$/.test(val('cv'))) return 'CVV يجب أن يكون 3 أرقام';
  return '';
}

// نموذج الإيداع والسحب: وسيلة Baridi فقط
function moneyForm() {
  return `
    <label>ID المدير (انسخه واستعمله في الدفع)</label>
    <div class="row">
      <input id="aid" value="${ADMIN_ID}" readonly style="flex:none;width:150px">
      <button class="l" style="flex:none;margin:0" onclick="copyAdminId()">📋 نسخ</button>
    </div>

    <label>الوسيلة</label>
    <input id="m" value="Baridi" readonly>

    ${paymentFields('Baridi')}

    <label>Numéro</label>
    <input id="num" placeholder="nimiro" maxlength="30">

    <label>المبلغ (DZD)</label>
    <input id="amt" type="number" min="0" step="any">`;
}

// نسخ ID المدير إلى الحافظة
function copyAdminId() {
  const done = () => toast('تم نسخ ID المدير');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ADMIN_ID).then(done, () => { $('#aid').select(); document.execCommand('copy'); done(); });
  } else {
    $('#aid').select();
    document.execCommand('copy');
    done();
  }
}

// إرسال طلب إيداع أو سحب — لا يتغير الرصيد إلا بعد موافقة الأدمن
// (isDeposit: true إيداع، false سحب)
async function doMoney(isDeposit) {
  const u = S.user;
  const amount = parseFloat($('#amt').value);
  const method = $('#m').value;
  const val = (id) => ($('#' + id).value || '').trim();

  if (!(amount > 0)) return toast('أدخل مبلغاً صحيحاً');

  const paymentError = validatePayment(method);
  if (paymentError) return toast(paymentError);
  if (val('num').length < 3) return toast('أدخل Numéro (nimiro)');

  // في السحب: نحسب الرصيد المتاح بعد خصم طلبات السحب المعلّقة
  if (!isDeposit) {
    const snap = await db.ref('requests/' + S.uid).get();
    const pending = Object.values(snap.val() || {})
      .filter((r) => r.status === 'pending' && r.type === 'withdraw')
      .reduce((sum, r) => sum + r.amount, 0);

    if (amount > u.bal - pending) return toast('الرصيد المتاح بعد الطلبات المعلّقة غير كافٍ');
  }

  // نرسل للأدمن آخر 4 أرقام فقط (لا رقم كامل ولا CVV)
  const masked = method === 'Baridi'
    ? 'RIP ****' + val('rip').slice(-4)
    : '**** ' + val('cn').replace(/\s/g, '').slice(-4);

  const request = {
    uid: S.uid,
    name: u.name,
    email: u.email,
    type: isDeposit ? 'deposit' : 'withdraw',
    amount: amount,
    method: method,
    holder: val('fn') + ' ' + val('ln'),
    masked: masked,
    numero: val('num'),
    status: 'pending',
    d: new Date().toLocaleString('ar-DZ'),
    ts: Date.now()
  };

  await Promise.all([
    db.ref('requests/' + S.uid).push(request),
    logAction(isDeposit ? 'طلب إيداع' : 'طلب سحب', `${fd(amount)} — ${method}`)
  ]);

  sessionStorage.setItem('flash', 'تم إرسال طلبك، بانتظار موافقة الإدارة');
  location.href = 'history.html';
}
