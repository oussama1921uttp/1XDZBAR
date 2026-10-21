/* صفحة messages.html — الرسائل
   - الرئيس (الأدمن) مثبّت دائماً في أول القائمة 📌
   - أصدقاؤك يُضافون من صفحة friends.html
   - الأدمن يرى كل الحسابات ويراسل أي أحد */

let ADMIN_UID = null;   // معرّف الرئيس (من meta/adminUid)
let DIR = {};           // (للأدمن فقط) كل الحسابات: uid -> { name, user, pid }
let FRIENDS = {};       // أصدقاؤك: uid -> { name, pid }
let INBOX = {};         // آخر رسالة لكل محادثة
let CHAT = { other: null, ref: null };

function messagesPage() {
  setTimeout(initMessages, 0);

  return `<div class="card">
    <h2>الرسائل</h2>
    <p class="mu">لإضافة أصدقاء جدد افتح صفحة <a href="friends.html">الأصدقاء</a>.</p>
    <div class="chat">
      <div class="chat-list">
        <input id="q" placeholder="بحث..." oninput="renderContacts()">
        <div id="cl">جارٍ التحميل...</div>
      </div>

      <div class="chat-box">
        <div id="ct" class="mu">اختر محادثة من القائمة</div>
        <div id="cm" class="chat-msgs"></div>
        <div class="row" id="cf" style="display:none">
          <input id="mt" maxlength="500" placeholder="اكتب رسالة..." onkeydown="if (event.key === 'Enter') sendMessage()">
          <button style="flex:none;margin:0" onclick="sendMessage()">إرسال</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function initMessages() {
  ADMIN_UID = (await db.ref('meta/adminUid').get()).val();

  // الأدمن وحده يقرأ دليل كل الحسابات
  if (S.isAdmin) DIR = (await db.ref('directory').get()).val() || {};
  FRIENDS = (await db.ref('friends/' + S.uid).get()).val() || {};

  db.ref('friends/' + S.uid).on('value', (s) => { FRIENDS = s.val() || {}; renderContacts(); });
  db.ref('inbox/' + S.uid).on('value', (s) => { INBOX = s.val() || {}; renderContacts(); });

  // فتح محادثة مباشرة من رابط مثل messages.html?chat=UID
  const chat = new URLSearchParams(location.search).get('chat');
  if (chat) openChat(chat);
}

/* ---------- قائمة جهات الاتصال ---------- */

// الأدمن: كل الحسابات | غيره: الرئيس مثبّت + الأصدقاء
function contactList() {
  const q = ($('#q') ? $('#q').value : '').trim().toLowerCase();
  let items;

  if (S.isAdmin) {
    items = Object.entries(DIR)
      .filter(([uid]) => uid !== S.uid)
      .map(([uid, d]) => ({ uid, name: d.name || d.user || '—', pid: d.pid, pinned: false }));
  } else {
    items = Object.entries(FRIENDS).map(([uid, d]) => ({ uid, name: d.name, pid: d.pid, pinned: false }));

    // الرئيس موجود دائماً في الأول
    if (ADMIN_UID) items.push({ uid: ADMIN_UID, name: 'الرئيس', pid: ADMIN_ID, pinned: true });
  }

  items.forEach((i) => { i.last = (INBOX[i.uid] || {}).ts || 0; });

  return items
    .filter((i) => i.pinned || i.name.toLowerCase().includes(q) || String(i.pid || '').includes(q))
    .sort((a, b) => (b.pinned - a.pinned) || (b.last - a.last) || a.name.localeCompare(b.name));
}

function renderContacts() {
  if (!$('#cl')) return;

  const rows = contactList().map((c) => {
    const info = INBOX[c.uid] || {};
    return `<div class="chat-item ${c.uid === CHAT.other ? 'on' : ''}" onclick="openChat('${esc(c.uid)}')">
      <div>
        ${c.pinned ? '📌 ' : ''}<b>${esc(c.name)}</b>
        ${c.pinned ? '<span class="badge b-ok">EPINGLE</span>' : ''}
        ${info.unread ? '<span class="badge b-no">جديد</span>' : ''}
      </div>
      <div class="mu">${c.pid ? 'ID ' + esc(c.pid) + ' — ' : ''}${esc((info.text || '').slice(0, 30))}</div>
    </div>`;
  }).join('');

  // إن لم يسجّل الرئيس دخوله بعد، نُبقي مكانه ظاهراً في الأعلى
  const waiting = (!ADMIN_UID && !S.isAdmin)
    ? '<div class="chat-item mu">📌 <b>الرئيس</b> <span class="badge b-ok">EPINGLE</span><div>سيظهر هنا بعد أن يسجّل دخوله</div></div>'
    : '';

  $('#cl').innerHTML = waiting + (rows || '<div class="mu">لا توجد جهات اتصال بعد</div>');
}

/* ---------- المحادثة ---------- */

function chatId(a, b) {
  return [a, b].sort().join('_');
}

function nameOf(uid) {
  if (uid === ADMIN_UID) return 'الرئيس';
  const d = FRIENDS[uid] || DIR[uid] || {};
  return d.name || d.user || '—';
}

function openChat(uid) {
  if (CHAT.ref) CHAT.ref.off();   // نوقف متابعة المحادثة السابقة

  CHAT.other = uid;
  $('#ct').innerHTML = `<b>${uid === ADMIN_UID ? '📌 ' : ''}${esc(nameOf(uid))}</b>`;
  $('#cm').innerHTML = '';
  $('#cf').style.display = 'flex';

  CHAT.ref = db.ref('chats/' + chatId(S.uid, uid));
  CHAT.ref.on('child_added', (snap) => appendMessage(snap.val()));

  if (INBOX[uid]) db.ref(`inbox/${S.uid}/${uid}/unread`).set(false);   // مقروءة

  renderContacts();
}

function appendMessage(m) {
  const box = $('#cm');
  if (!box) return;

  const mine = m.from === S.uid;
  box.insertAdjacentHTML('beforeend', `<div class="msg ${mine ? 'me' : 'them'}">
    <div>${esc(m.text)}</div>
    <div class="msg-t">${esc(m.d)}</div>
  </div>`);
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const text = $('#mt').value.trim();
  if (!text || !CHAT.other) return;

  const other = CHAT.other;
  const now = Date.now();
  const msg = { from: S.uid, to: other, text, ts: now, d: new Date().toLocaleString('ar-DZ') };

  $('#mt').value = '';

  try {
    await db.ref('chats/' + chatId(S.uid, other)).push(msg);
    await Promise.all([
      db.ref(`inbox/${S.uid}/${other}`).set({ text, ts: now, unread: false }),
      db.ref(`inbox/${other}/${S.uid}`).set({ text, ts: now, unread: true })
    ]);
  } catch (err) {
    toast('تعذر إرسال الرسالة');
  }
}

startPage({ key: 'messages', access: 'user', render: messagesPage });
