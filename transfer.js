/* صفحة transfer.html — تحويل أموال إلى حساب آخر عبر ID */

let RECIPIENT = null;   // { uid, pid, name } بعد البحث

function transferPage() {
  const u = S.user;
  setTimeout(prefillRecipient, 0);

  return `<div class="card">
    <h2>تحويل أموال</h2>
    <p class="mu">ID الخاص بك: <b style="user-select:all">${esc(u.pid || '')}</b> — رصيدك: <b>${fd(u.bal)}</b></p>

    <label>ID المستلم (8 أرقام)</label>
    <input id="tid" inputmode="numeric" maxlength="8" oninput="lookupRecipient()">
    <div id="tn" class="mu"></div>

    <label>المبلغ (DZD) — الحد الأدنى ${fd(MIN_TRANSFER)}</label>
    <input id="ta" type="number" min="${MIN_TRANSFER}" step="any">

    <label>ملاحظة (اختياري)</label>
    <input id="tnote" maxlength="80">

    <button class="g" onclick="doTransfer()">تحويل</button>
  </div>`;
}

// تعبئة ID المستلم من رابط مثل transfer.html?to=12345678
function prefillRecipient() {
  const to = new URLSearchParams(location.search).get('to');
  if (to && $('#tid')) { $('#tid').value = to; lookupRecipient(); }
}

// البحث عن صاحب الـ ID وعرض اسمه
async function lookupRecipient() {
  RECIPIENT = null;
  const pid = $('#tid').value.trim();
  const out = $('#tn');

  out.className = 'mu';
  if (pid.length < 8) { out.textContent = ''; return; }
  if (!/^\d{8}$/.test(pid)) { out.textContent = 'ID غير صالح'; return; }
  if (pid === S.user.pid) { out.textContent = 'هذا ID حسابك أنت'; return; }

  out.textContent = 'جارٍ البحث...';
  try {
    const uid = (await db.ref('ids/' + pid).get()).val();
    if (!uid) { out.className = 'mu dn'; out.textContent = 'لا يوجد حساب بهذا ID'; return; }

    const d = (await db.ref('directory/' + uid).get()).val() || {};
    RECIPIENT = { uid, pid, name: d.name || 'مستخدم' };
    out.className = 'mu up';
    out.textContent = 'المستلم: ' + RECIPIENT.name;
  } catch (err) {
    out.textContent = 'تعذر البحث';
  }
}

async function doTransfer() {
  const u = S.user;
  const amount = parseFloat($('#ta').value);

  if (!RECIPIENT) return toast('أدخل ID صحيحاً لحساب موجود');
  if (!(amount > 0)) return toast('أدخل مبلغاً صحيحاً');
  if (amount < MIN_TRANSFER) return toast('الحد الأدنى ' + fd(MIN_TRANSFER));
  if (amount > u.bal) return toast('رصيدك غير كافٍ');
  if (!confirm(`تحويل ${fd(amount)} إلى ${RECIPIENT.name} (ID ${RECIPIENT.pid})؟`)) return;

  const key = db.ref('transfers/' + RECIPIENT.uid).push().key;
  const newBalance = u.bal - amount;

  try {
    // خصم رصيدك وإنشاء التحويل في عملية واحدة (إما كلاهما أو لا شيء)
    await db.ref().update({
      ['users/' + S.uid + '/bal']: newBalance,
      [`transfers/${RECIPIENT.uid}/${key}`]: {
        from: S.uid,
        fromName: u.name,
        fromPid: u.pid,
        amount: amount,
        note: $('#tnote').value.trim().slice(0, 80),
        status: 'pending',
        d: new Date().toLocaleString('ar-DZ'),
        ts: Date.now()
      }
    });

    u.bal = newBalance;
    await addTx('تحويل مرسل', '-' + f(amount), `إلى ${RECIPIENT.name} (ID ${RECIPIENT.pid})`);

    sessionStorage.setItem('flash', 'تم إرسال التحويل');
    location.href = 'history.html';
  } catch (err) {
    fail(err, 'تعذر التحويل');
  }
}

startPage({ key: 'transfer', access: 'user', render: transferPage });
