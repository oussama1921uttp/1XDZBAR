/* صفحة admin.html — لوحة الأدمن الكاملة
   - ملخص عام
   - طلبات الإيداع والسحب (موافقة / رفض)
   - كل الحسابات وأرصدتها (+ إضافة وسحب رصيد، حذف)
   - سجل المعاملات + سجل كل الأنشطة */

let ADMIN_REQ = {};
let ADMIN_USERS = {};  // الحسابات المحمّلة: uid -> بياناته   // الطلبات المحمّلة: 'uid/rid' -> الطلب

function adminPage() {
  setTimeout(loadAdminData, 0);   // نحمّل البيانات بعد رسم الصفحة

  return `<div class="card"><h2>ملخص</h2><div id="as" class="stats">جارٍ التحميل...</div></div>

  <div class="card">
    <h2>طلبات الإيداع والسحب</h2>
    <div class="sc" id="ar"></div>
  </div>

  <div class="card">
    <h2>إضافة حساب</h2>
    <p class="mu">إنشاء حساب جديد مباشرة (للأدمن فقط).</p>
    <div class="grid2">
      <div><label>اسم المستخدم</label><input id="nu"></div>
      <div><label>الاسم واللقب</label><input id="nm"></div>
      <div><label>البريد الإلكتروني</label><input id="ne" type="email"></div>
      <div><label>كلمة المرور (6 أحرف على الأقل)</label><input id="npw" type="text"></div>
      <div><label>الهاتف (اختياري)</label><input id="nph" inputmode="tel"></div>
      <div><label>الرصيد الابتدائي (DZD)</label><input id="nb" type="number" min="0" step="any" value="0"></div>
    </div>
    <button class="g" onclick="adminCreateAccount()">إنشاء الحساب</button>
  </div>

  <div class="card">
    <h2>الحسابات</h2>
    <p class="mu">كل الحسابات وما فيها من أموال. أدخل مبلغاً ثم + للإضافة أو − للسحب مباشرة.</p>
    <div id="eb"></div>
    <div class="sc" id="au"></div>
  </div>

  <div class="card"><h2>سجل المعاملات المالية</h2><div class="sc" id="at"></div></div>
  <div class="card"><h2>سجل كل الأنشطة</h2><div class="sc" id="al"></div></div>

  <div class="card" style="border-color:var(--dn)">
    <h3 class="dn">منطقة الخطر</h3>
    <p class="mu">حذف كل الحسابات وبياناتها (أرصدة، معاملات، رسائل، أصدقاء، تحويلات) وإبقاء حساب الأدمن فقط. لا يمكن التراجع.</p>
    <button class="r" onclick="adminPurge()">حذف كل الحسابات عدا الأدمن</button>
  </div>`;
}

async function loadAdminData() {
  try {
    const [usersSnap, txSnap, reqSnap, logsSnap] = await Promise.all([
      db.ref('users').get(),
      db.ref('tx').get(),
      db.ref('requests').get(),
      db.ref('logs').orderByChild('ts').limitToLast(300).get()
    ]);

    const users = usersSnap.val() || {};
    ADMIN_USERS = users;
    const allTx = txSnap.val() || {};
    const allReq = reqSnap.val() || {};
    const logs = Object.values(logsSnap.val() || {}).sort((a, b) => b.ts - a.ts);

    // تسطيح الطلبات
    ADMIN_REQ = {};
    Object.entries(allReq).forEach(([uid, list]) => {
      Object.entries(list).forEach(([rid, r]) => { ADMIN_REQ[uid + '/' + rid] = r; });
    });

    renderSummary(users);
    renderRequests();
    renderUsersTable(users);
    renderTxTable(users, allTx);
    renderLogsTable(logs);
  } catch (err) {
    $('#as').textContent = 'تعذر تحميل البيانات';
    fail(err, 'تعذر التحميل');
  }
}

/* ---------- الملخص ---------- */
function renderSummary(users) {
  const list = Object.values(users);
  const cash = list.reduce((sum, x) => sum + (x.bal || 0), 0);
  const all = list.reduce((sum, x) => sum + total({ bal: x.bal || 0, h: x.h || {} }), 0);
  const pending = Object.values(ADMIN_REQ).filter((r) => r.status === 'pending').length;

  $('#as').innerHTML = `
    <div><span class="mu">عدد الحسابات</span><b>${list.length}</b></div>
    <div><span class="mu">إجمالي النقد</span><b>${fd(cash)}</b></div>
    <div><span class="mu">إجمالي كل الأرصدة</span><b>${fd(all)}</b></div>
    <div><span class="mu">طلبات معلّقة</span><b class="${pending ? 'dn' : ''}">${pending}</b></div>`;
}

/* ---------- الطلبات ---------- */
function renderRequests() {
  const order = { pending: 0, approved: 1, rejected: 2 };
  const rows = Object.entries(ADMIN_REQ)
    .sort(([, a], [, b]) => (order[a.status] - order[b.status]) || (b.ts - a.ts))
    .slice(0, 100)
    .map(([key, r]) => {
      const [uid, rid] = key.split('/');
      const [label, cls] = REQUEST_STATUS[r.status] || [r.status, ''];
      const actions = r.status === 'pending'
        ? `<button class="g" style="margin:0;padding:4px 10px" onclick="adminDecide('${esc(uid)}','${esc(rid)}',true)">موافقة</button>
           <button class="r" style="margin:0;padding:4px 10px" onclick="adminDecide('${esc(uid)}','${esc(rid)}',false)">رفض</button>`
        : '';

      return `<tr>
        <td>${esc(r.d)}</td>
        <td>${esc(r.name)}<div class="mu">${esc(r.email)}</div></td>
        <td class="${r.type === 'deposit' ? 'up' : 'dn'}">${r.type === 'deposit' ? 'إيداع' : 'سحب'}</td>
        <td>${fd(r.amount)}</td>
        <td>${esc(r.method)}<div class="mu">${esc(r.holder)} — ${esc(r.masked)}</div>
          <div class="mu">Numéro: ${esc(r.numero || '-')}</div></td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td style="white-space:nowrap">${actions}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="mu">لا توجد طلبات</td></tr>';

  $('#ar').innerHTML = `<table>
    <tr><th>التاريخ</th><th>المستخدم</th><th>النوع</th><th>المبلغ</th><th>الوسيلة</th><th>الحالة</th><th>إجراء</th></tr>
    ${rows}
  </table>`;
}

// الموافقة على طلب أو رفضه
async function adminDecide(uid, rid, approve) {
  const req = ADMIN_REQ[uid + '/' + rid];
  if (!req) return;

  const statusRef = db.ref(`requests/${uid}/${rid}/status`);

  try {
    // نحجز الطلب أولاً حتى لا يُعالَج مرتين
    const claim = await claimStatus(statusRef, 'pending', approve ? 'approved' : 'rejected');
    if (!claim.committed) { toast('تمت معالجة هذا الطلب مسبقاً'); return loadAdminData(); }

    if (approve) {
      const sign = req.type === 'deposit' ? 1 : -1;

      const result = await changeBalance(uid, sign * req.amount);

      if (!result.committed) {   // رصيد غير كافٍ للسحب
        await db.ref(`requests/${uid}/${rid}`).update({ status: 'rejected', note: 'رصيد غير كافٍ' });
        toast('رصيد الحساب غير كافٍ، تم رفض الطلب');
        return loadAdminData();
      }

      await db.ref('tx/' + uid).push({
        t: req.type === 'deposit' ? 'إيداع' : 'سحب',
        amt: (sign > 0 ? '+' : '-') + f(req.amount),
        note: req.method + ' — بموافقة المدير',
        d: new Date().toLocaleString('ar-DZ'),
        ts: Date.now()
      });

      if (uid === S.uid) S.user.bal = result.snapshot.val();
    }

    await logAction(
      approve ? 'موافقة على طلب' : 'رفض طلب',
      `${req.type === 'deposit' ? 'إيداع' : 'سحب'} ${fd(req.amount)} — ${req.email}`
    );

    toast(approve ? 'تمت الموافقة' : 'تم الرفض');
    loadAdminData();
    renderNav();
  } catch (err) {
    fail(err, 'تعذر التنفيذ');
  }
}

/* ---------- جدول الحسابات ---------- */
function renderUsersTable(users) {
  const rows = Object.entries(users).map(([uid, x]) => {
    const assets = Object.entries(x.h || {})
      .filter(([, q]) => q > 0)
      .map(([s, q]) => `${s} ${q.toFixed(4)}`)
      .join('، ') || '-';

    const isSelf = uid === S.uid;

    return `<tr>
      <td><b>${esc(x.pid || '-')}</b></td>
      <td>${esc(x.user)}</td>
      <td>${esc(x.name)}</td>
      <td>${esc(x.email)}</td>
      <td>${esc(x.phone)}</td>
      <td>${esc(x.wil)}</td>
      <td>${esc(x.pm ? x.pm.t + ' ' + x.pm.k : '')}</td>
      <td>${esc(assets)}</td>
      <td><b>${fd(x.bal || 0)}</b></td>
      <td>${fd(total({ bal: x.bal || 0, h: x.h || {} }))}</td>
      <td style="white-space:nowrap">
        <input id="adj-${esc(uid)}" type="number" min="0" step="any" placeholder="DZD" style="width:80px">
        <button class="g" style="margin:0;padding:4px 10px" onclick="adminAdjust('${esc(uid)}', 1)">+</button>
        <button class="r" style="margin:0;padding:4px 10px" onclick="adminAdjust('${esc(uid)}', -1)">−</button>
        <button class="l" title="تعديل الحساب" onclick="adminEdit('${esc(uid)}')">✏️</button>
        <button class="l" title="إرسال رابط إعادة كلمة المرور" onclick="adminReset('${esc(x.email)}')">🔑</button>
        ${isSelf ? '' : `<button class="l" onclick="adminDelete('${esc(uid)}')">حذف</button>`}
      </td>
    </tr>`;
  }).join('');

  $('#au').innerHTML = `<table>
    <tr><th>ID</th><th>المستخدم</th><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الولاية</th><th>الدفع</th><th>الأصول</th><th>النقد</th><th>الإجمالي</th><th>إجراء</th></tr>
    ${rows}
  </table>`;
}

/* ---------- جدول المعاملات المالية ---------- */
function renderTxTable(users, allTx) {
  const rows = [];
  Object.entries(allTx).forEach(([uid, list]) => {
    Object.values(list).forEach((t) => {
      rows.push({ ...t, userName: users[uid] ? users[uid].name : '—' });
    });
  });
  rows.sort((a, b) => b.ts - a.ts);

  $('#at').innerHTML = `<table>
    <tr><th>المستخدم</th><th>التاريخ</th><th>النوع</th><th>DZD</th><th>تفاصيل</th></tr>
    ${rows.slice(0, 300).map((t) => `<tr>
      <td>${esc(t.userName)}</td><td>${esc(t.d)}</td><td>${esc(t.t)}</td><td>${esc(t.amt)}</td><td>${esc(t.note)}</td>
    </tr>`).join('')}
  </table>`;
}

/* ---------- سجل كل الأنشطة ---------- */
function renderLogsTable(logs) {
  $('#al').innerHTML = `<table>
    <tr><th>التاريخ</th><th>الفاعل</th><th>الإجراء</th><th>تفاصيل</th></tr>
    ${logs.map((l) => `<tr>
      <td>${esc(l.d)}</td><td>${esc(l.actor)}</td><td>${esc(l.action)}</td><td>${esc(l.details)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="mu">لا توجد أنشطة بعد</td></tr>'}
  </table>`;
}

/* ---------- إضافة أو سحب رصيد مباشرة (sign: 1 إضافة، -1 سحب) ---------- */
async function adminAdjust(uid, sign) {
  const amount = parseFloat($('#adj-' + uid).value);
  if (!(amount > 0)) return toast('أدخل مبلغاً صحيحاً');

  const delta = sign * amount;

  try {
    const result = await changeBalance(uid, delta);
    if (!result.committed) return toast('رصيد الحساب غير كافٍ للسحب');

    const label = sign > 0 ? 'إيداع من الإدارة' : 'سحب من الإدارة';

    await Promise.all([
      db.ref('tx/' + uid).push({
        t: label,
        amt: (sign > 0 ? '+' : '-') + f(amount),
        note: 'بواسطة المدير',
        d: new Date().toLocaleString('ar-DZ'),
        ts: Date.now()
      }),
      logAction(label, `${fd(amount)} — الحساب ${uid}`)
    ]);

    if (uid === S.uid) S.user.bal = result.snapshot.val();

    toast('تم تنفيذ العملية');
    loadAdminData();
    renderNav();
  } catch (err) {
    fail(err, 'تعذر التنفيذ');
  }
}

/* ---------- حذف بيانات حساب ---------- */
async function adminDelete(uid) {
  if (!confirm('حذف بيانات هذا الحساب ومعاملاته وطلباته نهائياً؟')) return;

  try {
    await Promise.all([
      db.ref('users/' + uid).remove(),
      db.ref('tx/' + uid).remove(),
      db.ref('requests/' + uid).remove(),
      db.ref('directory/' + uid).remove(),
      db.ref('inbox/' + uid).remove(),
      db.ref('friends/' + uid).remove(),
      db.ref('friendReq/' + uid).remove(),
      db.ref('transfers/' + uid).remove(),
      (ADMIN_USERS[uid] && ADMIN_USERS[uid].pid) ? db.ref('ids/' + ADMIN_USERS[uid].pid).remove() : null
    ]);
    await logAction('حذف حساب', uid);
    toast('تم الحذف');
    loadAdminData();
  } catch (err) {
    fail(err, 'تعذر الحذف');
  }
}

/* ---------- إنشاء حساب جديد (بواسطة الأدمن) ---------- */
async function adminCreateAccount() {
  const val = (id) => $('#' + id).value.trim();
  const balance = parseFloat($('#nb').value) || 0;

  if (val('nu').length < 3) return toast('اسم المستخدم 3 أحرف على الأقل');
  if (!val('nm')) return toast('أدخل الاسم واللقب');
  if (!/^\S+@\S+\.\S+$/.test(val('ne'))) return toast('بريد إلكتروني غير صالح');
  if (val('npw').length < 6) return toast('كلمة المرور 6 أحرف على الأقل');
  if (val('nph') && !/^0[567]\d{8}$/.test(val('nph'))) return toast('رقم هاتف غير صالح');
  if (balance < 0) return toast('الرصيد لا يمكن أن يكون سالباً');

  try {
    // نستعمل تطبيق Firebase ثانوياً حتى لا يُسجَّل خروج الأدمن
    const secondary = firebase.apps.find((a) => a.name === 'secondary')
      || firebase.initializeApp(firebaseConfig, 'secondary');

    const cred = await secondary.auth().createUserWithEmailAndPassword(val('ne'), val('npw'));
    const uid = cred.user.uid;
    await secondary.auth().signOut();

    const profile = {
      pid: await claimId(uid),
      user: val('nu'),
      name: val('nm'),
      email: val('ne'),
      phone: val('nph'),
      bal: balance,
      created: Date.now(),
      createdBy: 'admin'
    };

    await db.ref('users/' + uid).set(profile);
    await db.ref('directory/' + uid).set({ name: profile.name, user: profile.user, pid: profile.pid });

    if (balance > 0) {
      await db.ref('tx/' + uid).push({
        t: 'إيداع من الإدارة',
        amt: '+' + f(balance),
        note: 'رصيد ابتدائي',
        d: new Date().toLocaleString('ar-DZ'),
        ts: Date.now()
      });
    }

    await logAction('إنشاء حساب بواسطة المدير', `${val('ne')} — ${fd(balance)}`);

    ['nu', 'nm', 'ne', 'npw', 'nph'].forEach((id) => { $('#' + id).value = ''; });
    $('#nb').value = 0;
    toast('تم إنشاء الحساب');
    loadAdminData();
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') return toast('البريد مستخدم من قبل');
    fail(err, 'تعذر الإنشاء');
  }
}

/* ---------- إرسال رابط إعادة تعيين كلمة المرور لحساب ---------- */
async function adminReset(email) {
  if (!email) return toast('لا يوجد بريد لهذا الحساب');
  try {
    await auth.sendPasswordResetEmail(email);
    await logAction('إرسال رابط إعادة كلمة المرور', email);
    toast('أُرسل رابط إعادة تعيين كلمة المرور إلى ' + email);
  } catch (err) {
    fail(err, 'تعذر الإرسال');
  }
}

/* ---------- تعديل بيانات حساب ---------- */
function adminEdit(uid) {
  const x = ADMIN_USERS[uid];
  if (!x) return;

  const wilayas = WILAYAS
    .map((w) => `<option value="${w}" ${w === x.wil ? 'selected' : ''}>${w}</option>`)
    .join('');

  $('#eb').innerHTML = `<div class="card" style="border-color:var(--pr)">
    <h3>تعديل الحساب: ${esc(x.email)}</h3>
    <div class="grid2">
      <div><label>الاسم واللقب</label><input id="ed-n" value="${esc(x.name)}"></div>
      <div><label>اسم المستخدم</label><input id="ed-u" value="${esc(x.user)}"></div>
      <div><label>الهاتف</label><input id="ed-ph" value="${esc(x.phone)}"></div>
      <div><label>ID (8 أرقام)</label><input id="ed-p" maxlength="8" value="${esc(x.pid)}"></div>
      <div><label>الولاية</label><select id="ed-w"><option value="">—</option>${wilayas}</select></div>
      <div><label>الرمز البريدي</label><input id="ed-pc" value="${esc(x.post)}"></div>
    </div>
    <label>عنوان الإقامة</label>
    <input id="ed-a" value="${esc(x.addr)}">
    <button onclick="adminSaveEdit('${esc(uid)}')">حفظ</button>
    <button class="l" onclick="$('#eb').innerHTML = ''">إلغاء</button>
  </div>`;
  $('#eb').scrollIntoView({ behavior: 'smooth' });
}

async function adminSaveEdit(uid) {
  const x = ADMIN_USERS[uid];
  const val = (id) => $('#' + id).value.trim();
  const newPid = val('ed-p');

  if (!val('ed-n') || val('ed-u').length < 3) return toast('الاسم واسم المستخدم مطلوبان');
  if (!/^\d{8}$/.test(newPid)) return toast('ID يجب أن يكون 8 أرقام');

  try {
    // تغيير الـ ID: نحجز الجديد (يجب أن يكون غير مستعمل) ثم نحرّر القديم
    if (newPid !== x.pid) {
      const claim = await db.ref('ids/' + newPid).transaction((cur) => (cur === null ? uid : undefined));
      if (!claim.committed) return toast('هذا ID مستعمل من حساب آخر');
      if (x.pid) await db.ref('ids/' + x.pid).remove();
    }

    const changes = {
      name: val('ed-n'), user: val('ed-u'), phone: val('ed-ph'), pid: newPid,
      wil: val('ed-w'), post: val('ed-pc'), addr: val('ed-a')
    };

    await db.ref('users/' + uid).update(changes);
    await db.ref('directory/' + uid).set({
      name: uid === S.uid ? 'الرئيس' : changes.name, user: changes.user, pid: newPid
    });
    await logAction('تعديل حساب بواسطة المدير', `${x.email} (ID ${newPid})`);

    if (uid === S.uid) Object.assign(S.user, changes);

    toast('تم حفظ التعديلات');
    loadAdminData();
    renderNav();
  } catch (err) {
    fail(err, 'تعذر الحفظ');
  }
}

/* ---------- حذف كل الحسابات وإبقاء الأدمن ---------- */
async function adminPurge() {
  if (!confirm('سيتم حذف كل الحسابات وبياناتها وإبقاء حساب الأدمن فقط. متابعة؟')) return;
  if (prompt('للتأكيد النهائي اكتب: DELETE') !== 'DELETE') return toast('تم الإلغاء');

  try {
    const [usersSnap, idsSnap] = await Promise.all([db.ref('users').get(), db.ref('ids').get()]);

    const updates = { chats: null };
    const nodes = ['users', 'tx', 'requests', 'directory', 'inbox', 'friends', 'friendReq', 'transfers'];

    Object.keys(usersSnap.val() || {}).forEach((uid) => {
      if (uid === S.uid) return;
      nodes.forEach((n) => { updates[n + '/' + uid] = null; });
    });

    // علاقات الأدمن القديمة (رسائل وأصدقاء وتحويلات)
    ['inbox', 'friends', 'friendReq', 'transfers'].forEach((n) => { updates[n + '/' + S.uid] = null; });

    Object.entries(idsSnap.val() || {}).forEach(([pid, uid]) => {
      if (uid !== S.uid) updates['ids/' + pid] = null;
    });

    await db.ref().update(updates);
    await logAction('حذف كل الحسابات عدا الأدمن', '');

    toast('تم حذف كل الحسابات عدا الأدمن');
    loadAdminData();
  } catch (err) {
    fail(err, 'تعذر الحذف');
  }
}

startPage({ key: 'admin', access: 'admin', render: adminPage });
