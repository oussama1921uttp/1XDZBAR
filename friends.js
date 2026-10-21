/* صفحة friends.html — طلبات الصداقة وقائمة الأصدقاء
   تضيف صديقاً بإرسال طلب عبر ID، وبعد قبوله تستطيع مراسلته وتحويل المال له */

let ADMIN_UID = null;   // معرّف الرئيس (من meta/adminUid)
let FRIENDS = {};       // أصدقاؤك: uid -> { name, pid }
let REQS = {};          // طلبات واردة: fromUid -> { fromName, fromPid }

function friendsPage() {
  setTimeout(initFriends, 0);

  return `<div class="card">
    <h2>إضافة صديق</h2>
    <p class="mu">ID الخاص بك: <b style="user-select:all">${esc(S.user.pid || '')}</b> — أرسل طلب صداقة لأي حساب عبر ID.</p>
    <div class="row">
      <input id="fid" inputmode="numeric" maxlength="8" placeholder="ID الصديق (8 أرقام)">
      <button style="flex:none;margin:0" onclick="sendFriendRequest()">إرسال طلب صداقة</button>
    </div>
  </div>

  <div class="card">
    <h2>طلبات الصداقة</h2>
    <div id="fr">جارٍ التحميل...</div>
  </div>

  <div class="card">
    <h2>أصدقائي</h2>
    <div id="fl"></div>
  </div>`;
}

function initFriends() {
  db.ref('meta/adminUid').get().then((s) => { ADMIN_UID = s.val(); });
  db.ref('friends/' + S.uid).on('value', (s) => { FRIENDS = s.val() || {}; renderFriends(); });
  db.ref('friendReq/' + S.uid).on('value', (s) => { REQS = s.val() || {}; renderRequests(); });
}

/* ---------- إرسال طلب ---------- */
async function sendFriendRequest() {
  const pid = $('#fid').value.trim();
  if (!/^\d{8}$/.test(pid)) return toast('ID يجب أن يكون 8 أرقام');
  if (pid === S.user.pid) return toast('هذا ID حسابك أنت');

  try {
    const uid = (await db.ref('ids/' + pid).get()).val();
    if (!uid) return toast('لا يوجد حساب بهذا ID');
    if (uid === ADMIN_UID) return toast('الرئيس موجود دائماً في قائمة رسائلك');
    if (FRIENDS[uid]) return toast('هذا الحساب صديقك بالفعل');
    if (REQS[uid]) return acceptRequest(uid);   // هو أرسل لك طلباً: نقبله مباشرة

    await db.ref(`friendReq/${uid}/${S.uid}`).set({
      fromName: S.user.name,
      fromPid: S.user.pid,
      status: 'pending',
      ts: Date.now()
    });
    $('#fid').value = '';
    toast('تم إرسال طلب الصداقة');
  } catch (err) {
    toast('تعذر الإرسال: ربما أرسلت طلباً لهذا الحساب من قبل');
  }
}

/* ---------- الطلبات الواردة ---------- */
function renderRequests() {
  const box = $('#fr');
  if (!box) return;

  const rows = Object.entries(REQS).map(([uid, r]) => `<div class="coin" style="cursor:default">
    <div><b>${esc(r.fromName)}</b> <span class="mu">ID ${esc(r.fromPid)}</span></div>
    <div>
      <button class="g" style="margin:0 6px;padding:4px 12px" onclick="acceptRequest('${esc(uid)}')">قبول</button>
      <button class="r" style="margin:0;padding:4px 12px" onclick="rejectRequest('${esc(uid)}')">رفض</button>
    </div>
  </div>`).join('');

  box.innerHTML = rows || '<p class="mu">لا توجد طلبات حالياً</p>';
}

async function acceptRequest(fromUid) {
  const r = REQS[fromUid];
  if (!r) return;

  try {
    // نعلّم الطلب مقبولاً (تسمح القواعد حينها بإضافتك إلى قائمة الآخر)
    await db.ref(`friendReq/${S.uid}/${fromUid}/status`).set('accepted');
    const now = Date.now();
    await Promise.all([
      db.ref(`friends/${S.uid}/${fromUid}`).set({ name: r.fromName, pid: r.fromPid, ts: now }),
      db.ref(`friends/${fromUid}/${S.uid}`).set({ name: S.user.name, pid: S.user.pid, ts: now })
    ]);
    await db.ref(`friendReq/${S.uid}/${fromUid}`).remove();
    toast('أصبحتما صديقين');
  } catch (err) {
    fail(err, 'تعذر القبول');
  }
}

async function rejectRequest(fromUid) {
  try {
    await db.ref(`friendReq/${S.uid}/${fromUid}`).remove();
    toast('تم رفض الطلب');
  } catch (err) {
    fail(err, 'تعذر الرفض');
  }
}

/* ---------- قائمة الأصدقاء ---------- */
function renderFriends() {
  const box = $('#fl');
  if (!box) return;

  const rows = Object.entries(FRIENDS)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([uid, d]) => `<div class="coin" style="cursor:default">
      <div><b>${esc(d.name)}</b> <span class="mu">ID ${esc(d.pid)}</span></div>
      <div>
        <button class="l" onclick="location.href='messages.html?chat=${esc(uid)}'">💬 مراسلة</button>
        <button class="l" onclick="location.href='transfer.html?to=${esc(d.pid)}'">💸 تحويل</button>
      </div>
    </div>`).join('');

  box.innerHTML = rows || '<p class="mu">لا يوجد أصدقاء بعد</p>';
}

startPage({ key: 'friends', access: 'user', render: friendsPage });
