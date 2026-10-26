/* =====================================================================
   1XDZBAR — app.js
   ملف JavaScript واحد: الإعدادات ← الأدوات ← البيانات ← السوق ← الصفحات.
   كل النصوص التي تظهر للمستخدم موجودة في ملفات HTML (القوالب وقسم #msgs).
   ===================================================================== */

/* ---------- 1) الإعدادات ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBGainTV-p9V4RSBWayXS4066_bAsUOFQ8",
  authDomain: "xdbar-ab33b.firebaseapp.com",
  databaseURL: "https://xdbar-ab33b-default-rtdb.firebaseio.com",
  projectId: "xdbar-ab33b",
  storageBucket: "xdbar-ab33b.firebasestorage.app",
  messagingSenderId: "809086945461",
  appId: "1:809086945461:web:78a6ee996f92f5c38b56fc"
};

const ADMIN_EMAIL = 'gerchouche999@gmail.com';   // بريد الأدمن
const ADMIN_START_BALANCE = 85000000;            // رصيد الأدمن (DZD)
const ADMIN_ID = '00000001';                     // ID الأدمن
const MIN_AMOUNT = 22;                           // الحد الأدنى (DZD) للتداول والتحويل والإيداع والسحب

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const pageKey = document.body.dataset.page;
const pageAccess = document.body.dataset.access;


/* ---------- 2) أدوات ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function f(n) { return Number(n).toLocaleString('en', { maximumFractionDigits: 2 }); }
function fd(n) { return f(n) + ' DZD'; }
function nowText() { return new Date().toLocaleString('ar-DZ'); }

// نص من قسم #msgs في HTML، مع استبدال {المتغيّرات}
function t(key, vars) {
  const el = $(`#msgs [data-k="${key}"]`);
  let s = el ? el.textContent : key;
  Object.keys(vars || {}).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}

let toastTimer;
function toastText(s) {
  const el = $('#toast');
  el.textContent = s;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2600);
}
function toast(key, vars) { toastText(t(key, vars)); }
function flash(key) { sessionStorage.setItem('flash', key); }

// وضع قيمة في كل عنصر فيه data-bind="name"
function bind(name, value) {
  $$(`[data-bind="${name}"]`).forEach((el) => { el.textContent = value; });
}

/*
  نسخ قالب <template> من HTML وتعبئته:
    data-f="key"     نص من data[key]
    data-c="key"     صنف CSS من data[key]
    data-show="key"  يظهر العنصر فقط إن كانت data[key] صحيحة
    data-value="key" قيمة حقل إدخال
    data-do="name"   دالة من handlers تُستدعى عند النقر
*/
function clone(tplId, data = {}, handlers = {}) {
  const node = document.getElementById(tplId).content.firstElementChild.cloneNode(true);
  [node, ...node.querySelectorAll('*')].forEach((el) => {
    const d = el.dataset;
    if (d.f !== undefined && data[d.f] !== undefined) el.textContent = data[d.f];
    if (d.c !== undefined && data[d.c]) el.className = (el.className + ' ' + data[d.c]).trim();
    if (d.show !== undefined) el.hidden = !data[d.show];
    if (d.bg !== undefined) el.style.background = data[d.bg];
    if (d.w !== undefined) el.style.width = data[d.w];
    if (d.value !== undefined && data[d.value] !== undefined) el.value = data[d.value];
    if (d.do !== undefined && handlers[d.do]) el.addEventListener('click', (ev) => handlers[d.do](data, ev));
  });
  return node;
}

function renderRows(box, empty, tplId, items, handlers) {
  const el = $(box);
  el.innerHTML = '';
  items.forEach((it) => el.append(clone(tplId, it, handlers)));
  if (empty) $(empty).hidden = items.length > 0;
}

function isPermissionError(err) {
  return /permission_denied|permission denied/i.test(((err && err.code) || '') + ((err && err.message) || ''));
}

function showPermissionHelp() {
  const box = $('#perm-help');
  if (!box) return;
  const u = auth.currentUser || {};
  bind('permemail', u.email || '');
  bind('permuid', u.uid || '');
  box.hidden = false;
}

// معالجة موحّدة لأخطاء قاعدة البيانات
function fail(err, prefixKey) {
  if (isPermissionError(err)) {
    showPermissionHelp();
    return toast('err_perm');
  }
  toastText((prefixKey ? t(prefixKey) + ': ' : '') + ((err && (err.code || err.message)) || ''));
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark' ||
    (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'light' : 'dark';
}

const REQUEST_CLASS = { pending: 'b-pending', approved: 'b-ok', rejected: 'b-no' };

/* علامة التوثيق: زرقاء للحسابات الموثّقة، حمراء للأدمن.
   مصدرها directory/{uid}/badge ولا يكتبها إلا الأدمن (تحمي ذلك القواعد). */
const BADGES = {};   // uid -> 'blue' | 'red' | ''
const badgeClass = (b) => (b === 'red' ? 'vb-red' : b === 'blue' ? 'vb-blue' : '');
const myBadge = () => (S.isAdmin ? 'red' : S.badge);

async function loadBadges(uids) {
  await Promise.all(uids.filter((u) => BADGES[u] === undefined).map(async (u) => {
    try { BADGES[u] = (await db.ref('directory/' + u + '/badge').get()).val() || ''; }
    catch (e) { BADGES[u] = ''; }
  }));
}


/* ---------- 3) الحالة والبيانات ---------- */
const S = {
  user: null,            // بيانات المستخدم الحالي
  uid: null,
  isAdmin: false,
  tx: [],                // معاملاته
  coinConfig: {},        // العملات من قاعدة البيانات
  favs: {},              // العملات المفضلة: الرمز -> true
  badge: '',             // علامة حسابي: blue أو فارغ
  registering: false,
  permissionProblem: false,
  listening: { config: false, balance: false, transfers: false, requests: false, favs: false, holdings: false }
};

function saveUser() {
  return db.ref('users/' + S.uid).update({ bal: S.user.bal, h: S.user.h, cost: S.user.cost });
}

// سجل عام لكل الأنشطة (يقرؤه الأدمن فقط)
function logAction(action, details) {
  const u = auth.currentUser;
  if (!u) return Promise.resolve();
  return db.ref('logs').push({
    uid: u.uid, actor: u.email, action, details: details || '', d: nowText(), ts: Date.now()
  });
}

function addTx(type, amount, note) {
  const entry = { t: type, amt: amount, note, d: nowText(), ts: Date.now() };
  S.tx.unshift(entry);
  return Promise.all([
    db.ref('tx/' + S.uid).push(entry),
    logAction(type, amount + ' — ' + note)
  ]);
}

// توليد ID فريد من 8 أرقام وحجزه (fixed: ID ثابت مطلوب)
async function claimId(uid, fixed) {
  for (let i = 0; i < 20; i++) {
    const pid = fixed || String(Math.floor(10000000 + Math.random() * 90000000));
    const r = await db.ref('ids/' + pid).transaction((cur) => (cur === null || cur === uid) ? uid : undefined);
    if (r.committed) return pid;
    if (fixed) break;
  }
  throw new Error('id');
}

// transaction تبدأ أحياناً بقيمة null، لذلك نقرأ القيمة أولاً
async function changeBalance(uid, delta) {
  const ref = db.ref('users/' + uid + '/bal');
  const known = (await ref.get()).val() || 0;
  return ref.transaction((bal) => {
    const next = (bal === null ? known : bal) + delta;
    return next < 0 ? undefined : next;
  });
}

// تعديل ملف حساب كاملاً بشكل ذرّي: fn تعدّل نسخة وتُرجعها، أو تُرجع undefined للإلغاء
async function updateUser(uid, fn) {
  const ref = db.ref('users/' + uid);
  const known = (await ref.get()).val();
  return ref.transaction((u) => {
    const cur = u === null ? known : u;
    if (!cur) return undefined;
    return fn(JSON.parse(JSON.stringify(cur)));
  });
}

// تغيير حالة من from إلى to مرة واحدة فقط
async function claimStatus(ref, from, to) {
  const known = (await ref.get()).val();
  return ref.transaction((s) => ((s === null ? known : s) === from ? to : undefined));
}

// تحويل وارد: المبلغ يُضاف إلى رصيدك لحظة الإرسال، وهنا نسجّله في سجلك ونُعلمك
// (تحويلات قديمة بحالة pending يُضاف مبلغها هنا)
async function receiveTransfer(tid, tr) {
  if (!tr || (tr.status !== 'credited' && tr.status !== 'pending')) return;

  const claim = await claimStatus(db.ref(`transfers/${S.uid}/${tid}/status`), tr.status, 'received');
  if (!claim.committed) return;

  if (tr.status === 'pending') await changeBalance(S.uid, tr.amount);
  if (tr.kind === 'p2p') {   // اشترى أحدهم عملتك: المبلغ أُضيف إلى رصيدك، وهنا نسجّله
    await addTx(t('tx_p2p_sold'), '+' + f(tr.amount), t('note_p2p_sold', { sym: tr.sym, qty: Number(tr.qty).toFixed(6), name: tr.fromName }));
    bindUser();
    return toast('p2p_sold_notice', { sym: tr.sym, amount: fd(tr.amount) });
  }
  await addTx(t('tx_received'), '+' + f(tr.amount), t('note_from', { name: tr.fromName, pid: tr.fromPid }));
  bindUser();
  toast('transfer_received', { amount: fd(tr.amount), name: tr.fromName });
}

async function loadUser(uid, email) {
  S.uid = uid;
  S.isAdmin = (email || '').toLowerCase() === ADMIN_EMAIL;

  const [profile, tx, coins, adminNode, favNode, badgeNode] = await Promise.all([
    db.ref('users/' + uid).get(),
    db.ref('tx/' + uid).get(),
    db.ref('coins').get(),
    db.ref('admins/' + uid).get().catch(() => ({ val: () => null })),
    db.ref('favorites/' + uid).get().catch(() => ({ val: () => null })),
    db.ref('directory/' + uid + '/badge').get().catch(() => ({ val: () => null }))
  ]);

  if (adminNode.val() === true) S.isAdmin = true;

  S.user = profile.val();

  // أول دخول للأدمن: نُنشئ ملفه
  if (!S.user && S.isAdmin) {
    S.user = { user: 'admin', name: t('admin_name'), email, phone: '', bal: ADMIN_START_BALANCE, seeded: true, created: Date.now() };
    await db.ref('users/' + uid).set(S.user);
  }
  if (S.user && S.isAdmin && !S.user.seeded) {
    S.user.bal = ADMIN_START_BALANCE;
    S.user.seeded = true;
    await db.ref('users/' + uid).update({ bal: S.user.bal, seeded: true });
  }

  S.tx = Object.values(tx.val() || {}).sort((a, b) => b.ts - a.ts);
  S.coinConfig = coins.val() || {};
  S.favs = favNode.val() || {};
  S.badge = badgeNode.val() || '';
  refreshCoins();

  if (!S.user) return;

  S.user.h = S.user.h || {};
  S.user.cost = S.user.cost || {};

  // ID لكل حساب (الأدمن له ID ثابت)
  try {
    if (!S.user.pid) {
      S.user.pid = await claimId(uid, S.isAdmin ? ADMIN_ID : null);
      await db.ref('users/' + uid).update({ pid: S.user.pid });
    } else if (S.isAdmin && S.user.pid !== ADMIN_ID) {
      const old = S.user.pid;
      S.user.pid = await claimId(uid, ADMIN_ID);
      await db.ref('users/' + uid).update({ pid: ADMIN_ID });
      db.ref('ids/' + old).remove().catch(() => {});
    }
  } catch (e) { /* نعيد المحاولة في الدخول القادم */ }

  // دليل الأسماء ومعرّف الأدمن
  db.ref('directory/' + uid)
    .update({ name: S.isAdmin ? t('president') : S.user.name, user: S.user.user || '', pid: S.user.pid || '' })
    .catch(() => {});
  if (S.isAdmin) db.ref('meta/adminUid').set(uid).catch(() => { S.permissionProblem = true; });
  if (S.isAdmin) db.ref('directory/' + uid + '/badge').set('red').catch(() => {});

  // متابعات حيّة
  if (!S.listening.config) {
    S.listening.config = true;
    db.ref('coins').on('value', (snap) => { S.coinConfig = snap.val() || {}; refreshCoins(); });
  }
  if (!S.listening.balance) {
    S.listening.balance = true;
    db.ref('users/' + uid + '/bal').on('value', (snap) => {
      if (S.user && snap.val() !== null) S.user.bal = snap.val();
    });
  }
  if (!S.listening.transfers) {
    S.listening.transfers = true;
    db.ref('transfers/' + uid).on('child_added', (snap) => receiveTransfer(snap.key, snap.val()), () => {});
  }
  if (!S.listening.favs) {
    S.listening.favs = true;
    db.ref('favorites/' + uid).on('value', (snap) => {
      S.favs = snap.val() || {};
      refreshStars();
      if (started && pageKey === 'favorites') renderCoinList();
    }, () => {});
  }
  if (!S.listening.holdings) {
    S.listening.holdings = true;
    ['h', 'cost'].forEach((k) => {
      db.ref('users/' + uid + '/' + k).on('value', (snap) => { if (S.user) S.user[k] = snap.val() || {}; }, () => {});
    });
  }
}

function startAuthListener(onChange) {
  auth.onAuthStateChanged(async (fu) => {
    if (S.registering) return;

    if (!fu) {
      S.user = null; S.uid = null; S.isAdmin = false; S.tx = [];
    } else {
      try {
        await loadUser(fu.uid, fu.email);
      } catch (err) {
        bind('loaderr', err.message);
        $('#load-error').hidden = false;
        showPermissionHelp();
        document.body.classList.remove('loading');
        return;
      }
      if (!S.user) { await auth.signOut(); return; }
    }
    onChange();
  });
}

// الخروج: ننهي الجلسة ثم نعود دائماً إلى login.html
async function logout() {
  try { await logAction(t('log_logout'), ''); } catch (e) {}
  try { await auth.signOut(); } catch (e) {}
  location.href = 'login.html';
}


/* ---------- 4) سوق العملات (محاكاة) ---------- */
let COINS = [];

function currentTick() { return Math.floor(Date.now() / 2000); }

// سعر العملة عند خطوة معيّنة: يتحرك دائماً بين الحد الأدنى والأقصى للنسبة
// (cfg.p السعر الأساسي، cfg.min و cfg.max نسبة مئوية عن السعر الأساسي)
function priceAt(symbol, cfg, k) {
  const phase = [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const wave = (Math.sin(k / 23 + phase) + 0.6 * Math.sin(k / 7.1 + 2 * phase) + 0.35 * Math.sin(k / 2.9 + 3 * phase)) / 1.95;   // من -1 إلى 1
  const lo = cfg.min !== undefined ? cfg.min : -(cfg.vol || 2);
  const hi = cfg.max !== undefined ? cfg.max : (cfg.vol || 2);
  const pct = (lo + hi) / 2 + ((hi - lo) / 2) * wave;
  return Math.max(0.000001, cfg.p * (1 + pct / 100));
}

function refreshCoins() {
  const k = currentTick();
  COINS = Object.entries(S.coinConfig).map(([symbol, cfg]) => {
    const h = [];
    for (let i = 59; i >= 0; i--) h.push(priceAt(symbol, cfg, k - i));
    const lo = cfg.min !== undefined ? cfg.min : -(cfg.vol || 2);
    const hi = cfg.max !== undefined ? cfg.max : (cfg.vol || 2);
    return { s: symbol, n: cfg.n, basePrice: cfg.p, min: lo, max: hi, p: h[59], h };
  });
}

const coin = (symbol) => COINS.find((c) => c.s === symbol);

function total(user) {
  const holdings = Object.entries(user.h || {}).reduce((sum, [s, q]) => {
    const c = coin(s);
    return sum + (c ? q * c.p : 0);
  }, 0);
  return user.bal + holdings;
}

function renderChart(c) {
  const w = 600, h = 220;
  const min = Math.min(...c.h), max = Math.max(...c.h), range = (max - min) || 1;
  const pts = c.h.map((v, i) =>
    ((i / (c.h.length - 1)) * w).toFixed(1) + ',' + (h - 8 - ((v - min) / range) * (h - 16)).toFixed(1)).join(' ');
  const color = c.h[c.h.length - 1] >= c.h[0] ? 'var(--up)' : 'var(--dn)';
  return `<svg viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

// التغيّر عن السعر الأساسي (يبقى دائماً بين الحد الأدنى والأقصى)
function coinChange(c) {
  const ch = (c.p / c.basePrice - 1) * 100;
  return { text: (ch >= 0 ? '▲ ' : '▼ ') + f(Math.abs(ch)) + '%', cls: ch >= 0 ? 'up' : 'dn' };
}


/* ---------- 5) هيكل الصفحة والتشغيل ---------- */
function bindUser() {
  const u = S.user;
  if (!u) return;
  bind('name', u.name);
  bind('pid', u.pid || '');
  bind('total', fd(total(u)));
  bind('cash', fd(u.bal));
  $$('[data-mybadge]').forEach((el) => { el.className = 'vb ' + badgeClass(myBadge()); });
}

function setupShell() {
  bindUser();
  $$('[data-nav]').forEach((a) => {
    a.classList.toggle('on', a.dataset.nav === pageKey || (pageKey === 'trade' && a.dataset.nav === 'home'));
  });
  $$('[data-admin]').forEach((a) => { a.hidden = !S.isAdmin; });

  // عدّاد طلبات الصداقة في القائمة
  if (!S.listening.requests) {
    S.listening.requests = true;
    db.ref('friendReq/' + S.uid).on('value', (snap) => {
      const n = snap.numChildren();
      bind('reqcount', n);
      $$('[data-bind="reqcount"]').forEach((el) => { el.hidden = !n; });
    }, () => {});
  }
  if (S.isAdmin && S.permissionProblem) showPermissionHelp();
}

/* ---------- القائمة الجانبية: زر ☰ أو سحب بالإصبع من اليمين على الجوال ---------- */
const isDrawer = () => window.matchMedia('(max-width: 900px)').matches;

function toggleMenu(force) {
  const open = force === undefined ? !document.body.classList.contains('menu-open') : force;
  document.body.classList.toggle('menu-open', open);
}

(function enableMenuSwipe() {
  const nav = $('#nav'), scrim = $('#scrim');
  if (!nav || !scrim) return;

  let start = null, dragging = false, opening = false, width = 0;

  document.addEventListener('touchstart', (e) => {
    if (!isDrawer()) return;
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    const open = document.body.classList.contains('menu-open');
    if (!open && window.innerWidth - x > 30) return;   // الفتح يبدأ من حافة اليمين، والإغلاق من أي مكان
    start = { x, y };
    opening = !open;
    dragging = false;
    width = nav.offsetWidth;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!start) return;
    const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y;
    if (!dragging) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;   // ليس سحباً أفقياً
      dragging = true;
      nav.classList.add('dragging');
      scrim.style.transition = 'none';
    }
    // offset: 0 مفتوحة بالكامل، width مغلقة (الدرج على اليمين)
    const offset = Math.max(0, Math.min(width, opening ? width + dx : dx));
    nav.style.transform = `translateX(${offset}px)`;
    scrim.style.opacity = String(1 - offset / width);
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const wasDragging = dragging;
    nav.classList.remove('dragging');
    nav.style.transform = '';
    scrim.style.transition = '';
    scrim.style.opacity = '';
    start = null;
    dragging = false;
    if (wasDragging) toggleMenu(opening ? dx < -width / 3 : dx < width / 3);
  }, { passive: true });
})();

let started = false;
function startPage() {
  startAuthListener(() => {
    const loggedIn = !!S.user;

    if (pageAccess === 'public') {
      if (loggedIn) return location.replace('index.html');
    } else {
      if (!loggedIn) return location.replace('login.html');
      if (pageAccess === 'admin' && !S.isAdmin) return location.replace('index.html');
    }
    if (started) return;
    started = true;

    if (loggedIn) setupShell();

    const msg = sessionStorage.getItem('flash');
    if (msg) { sessionStorage.removeItem('flash'); setTimeout(() => toast(msg), 200); }

    const page = PAGES[pageKey] || {};
    if (page.init) page.init();
    document.body.classList.remove('loading');
  });
}


/* ---------- 6) الصفحات ---------- */

/* ===== login.html ===== */
async function doLogin() {
  const email = $('#e').value.trim();
  try {
    await auth.signInWithEmailAndPassword(email, $('#p').value);
    logAction(t('log_login'), email);
  } catch (err) {
    toast('bad_login');
  }
}

/* ===== register.html ===== */
function changeMethod() {
  const baridi = $('#m').value === 'Baridi';
  $('#pay-baridi').hidden = !baridi;
  $('#pay-dahab').hidden = baridi;
}

// فحص حقول بريدي (prefix لمعرّفات الحقول) → مفتاح الرسالة أو ''
function checkBaridi(p) {
  const v = (id) => $('#' + p + id).value.trim();
  if (!v('fn') || !v('ln')) return 'err_name';
  return /^\d{20}$/.test(v('rip')) ? '' : 'err_rip';
}

function checkDahab() {
  const v = (id) => $('#d-' + id).value.trim();
  if (!v('fn') || !v('ln')) return 'err_name';
  if (!/^\d{16}$/.test(v('cn').replace(/\s/g, ''))) return 'err_card';
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(v('ex'))) return 'err_expiry';
  return /^\d{3}$/.test(v('cv')) ? '' : 'err_cvv';
}

function registerError(v, method) {
  if (v('un').length < 3) return 'err_user';
  if (!/^\S+@\S+\.\S+$/.test(v('e'))) return 'err_email';
  if (!/^0[567]\d{8}$/.test(v('ph'))) return 'err_phone';
  if ($('#p').value.length < 6) return 'err_pass_len';
  if ($('#p').value !== $('#p2').value) return 'err_pass_match';
  if (!v('n') || !v('l')) return 'err_names';
  if (!$('#bd').value) return 'err_birth';
  const pay = method === 'Baridi' ? checkBaridi('b-') : checkDahab();
  if (pay) return pay;
  if (!v('w')) return 'err_wil';
  if (!/^\d{5}$/.test(v('pc'))) return 'err_post';
  if (!v('ad')) return 'err_addr';
  return '';
}

async function doRegister() {
  const v = (id) => $('#' + id).value.trim();
  const method = $('#m').value;

  const error = registerError(v, method);
  if (error) return toast(error);

  // نحفظ آخر 4 أرقام فقط من وسيلة الدفع
  const pm = method === 'Baridi'
    ? { t: method, h: v('b-fn') + ' ' + v('b-ln'), k: t('mask_rip') + v('b-rip').slice(-4) }
    : { t: method, h: v('d-fn') + ' ' + v('d-ln'), k: t('mask_card') + ' ' + v('d-cn').replace(/\s/g, '').slice(-4) };

  const profile = {
    user: v('un'), name: v('n') + ' ' + v('l'), email: v('e'), phone: v('ph'),
    birth: $('#bd').value, wil: v('w'), post: v('pc'), addr: v('ad'), pm, bal: 0, created: Date.now()
  };

  S.registering = true;   // نوقف المستمع حتى يُحفظ الملف الشخصي
  try {
    const cred = await auth.createUserWithEmailAndPassword(v('e'), $('#p').value);
    profile.pid = await claimId(cred.user.uid);
    await db.ref('users/' + cred.user.uid).set(profile);
    await logAction(t('log_register'), v('e'));
    location.href = 'index.html';
  } catch (err) {
    S.registering = false;
    if (err.code === 'auth/email-already-in-use') return toast('email_taken');
    toastText(t('reg_fail') + ': ' + (err.code || err.message));
  }
}

/* ===== index.html و favorites.html: قائمة العملات ===== */
function coinRowData(c) {
  const ch = coinChange(c);
  return { s: c.s, n: c.n, p: fd(c.p), c: ch.text, cc: ch.cls };
}

// العملات الظاهرة: في المفضلة ما أضفته، وفي الرئيسية ما يطابق البحث
function visibleCoins() {
  if (pageKey === 'favorites') return COINS.filter((c) => S.favs[c.s]);
  const q = $('#cq') ? $('#cq').value.trim().toLowerCase() : '';
  return q ? COINS.filter((c) => c.s.toLowerCase().includes(q) || String(c.n || '').toLowerCase().includes(q)) : COINS;
}

function renderCoinList() {
  const list = visibleCoins();
  renderRows('#coins', '#coins-empty', 'tpl-coin', list.map(coinRowData), {
    star: (d, ev) => { ev.stopPropagation(); toggleFavorite(d.s); }
  });
  $$('#coins > *').forEach((row, i) => {
    row.dataset.sym = list[i].s;
    $('.star', row).dataset.star = list[i].s;
    row.addEventListener('click', () => { location.href = 'trade.html?coin=' + list[i].s; });
  });
  refreshStars();
}

function coinListLive() {
  const list = visibleCoins();
  if (list.length !== $$('#coins [data-sym]').length) return renderCoinList();
  list.forEach((c) => {
    const row = $(`#coins [data-sym="${c.s}"]`);
    if (!row) return;
    const d = coinRowData(c);
    $('[data-f="p"]', row).textContent = d.p;
    const ch = $('[data-f="c"]', row);
    ch.textContent = d.c;
    ch.className = d.cc;
  });
}

/* ---- النجمة: إضافة العملة إلى المفضلة أو نزعها ---- */
function refreshStars() {
  $$('[data-star]').forEach((el) => {
    const on = !!S.favs[el.dataset.star];
    el.textContent = on ? '★' : '☆';
    el.classList.toggle('on', on);
  });
}

async function toggleFavorite(sym) {
  const wasOn = !!S.favs[sym];
  if (wasOn) delete S.favs[sym]; else S.favs[sym] = true;
  refreshStars();
  if (pageKey === 'favorites') renderCoinList();

  try {
    const ref = db.ref(`favorites/${S.uid}/${sym}`);
    await (wasOn ? ref.remove() : ref.set(true));
  } catch (err) {
    if (wasOn) S.favs[sym] = true; else delete S.favs[sym];   // نتراجع إن فشل الحفظ
    refreshStars();
    if (pageKey === 'favorites') renderCoinList();
    fail(err, 'f_save');
  }
}

/* ===== trade.html ===== */
const SYMBOL = new URLSearchParams(location.search).get('coin');

function tradeDraw() {
  const c = coin(SYMBOL);
  if (!c) return location.replace('index.html');

  const u = S.user;
  const qty = u.h[c.s] || 0, invested = u.cost[c.s] || 0, value = qty * c.p, pnl = value - invested;

  bind('sym', c.s);
  $('#trade-star').dataset.star = c.s;
  bind('cname', c.n);
  bind('price', fd(c.p));
  bind('qty', qty.toFixed(6) + ' ' + c.s);
  bind('invested', fd(invested));
  bind('value', fd(value));
  bind('pnl', invested ? (pnl >= 0 ? '+' : '') + fd(pnl) : '-');
  $$('[data-bind="pnl"]').forEach((el) => { el.className = pnl >= 0 ? 'up' : 'dn'; });
  $('#chart').innerHTML = renderChart(c);
  refreshStars();
}

// isBuy: 1 شراء، 0 بيع
function fillAmount(isBuy, useMax) {
  const c = coin(SYMBOL);
  const available = isBuy ? S.user.bal : (S.user.h[SYMBOL] || 0) * c.p;
  const floored = Math.floor(available * 100) / 100;
  $('#amt' + isBuy).value = useMax ? floored : Math.min(MIN_AMOUNT, floored);
}

function doTrade(isBuy) {
  const u = S.user, c = coin(SYMBOL);
  const amount = parseFloat($('#amt' + isBuy).value);
  const maxAmount = isBuy ? u.bal : (u.h[SYMBOL] || 0) * c.p;

  if (!(amount > 0)) return toast('err_amount');
  if (amount < MIN_AMOUNT) return toast('err_min', { min: fd(MIN_AMOUNT) });
  if (amount > maxAmount + 1e-9) return toast('err_max', { max: fd(maxAmount) });

  const note = t('note_trade', { sym: SYMBOL, price: f(c.p) });
  let qty;

  if (isBuy) {
    qty = amount / c.p;
    u.bal -= amount;
    u.h[SYMBOL] = (u.h[SYMBOL] || 0) + qty;
    u.cost[SYMBOL] = (u.cost[SYMBOL] || 0) + amount;
    addTx(t('tx_buy'), '-' + f(amount), note);
  } else {
    const owned = u.h[SYMBOL] || 0;
    qty = amount >= maxAmount - 0.01 ? owned : amount / c.p;   // بيع كل الكمية عند Max
    u.cost[SYMBOL] = owned > 0 ? (u.cost[SYMBOL] || 0) * Math.max(0, 1 - qty / owned) : 0;
    u.h[SYMBOL] = Math.max(0, owned - qty);
    if (u.h[SYMBOL] < 1e-9) { u.h[SYMBOL] = 0; u.cost[SYMBOL] = 0; }
    u.bal += amount;
    addTx(t('tx_sell'), '+' + f(amount), note);
  }

  saveUser();
  $('#amt' + isBuy).value = '';
  toast(isBuy ? 'trade_bought' : 'trade_sold', { qty: qty.toFixed(6), sym: SYMBOL });
  bindUser();
  tradeDraw();
}

/* ===== wallet.html ===== */
const PALETTE = ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6'];

function walletInit() {
  const u = S.user, tv = total(u);
  bind('holdings', fd(tv - u.bal));
  bind('pm', u.pm ? `${u.pm.t} — ${u.pm.h} — ${u.pm.k}` : '—');

  const owned = Object.entries(u.h).filter(([s, q]) => q > 0 && coin(s));

  const cards = owned.map(([s, qty], i) => {
    const c = coin(s), invested = u.cost[s] || 0, value = qty * c.p, pct = invested ? (value / invested - 1) * 100 : null;
    return {
      s, n: c.n, ab: s.slice(0, 2), color: PALETTE[i % PALETTE.length],
      qty: qty.toFixed(6), avg: invested ? fd(invested / qty) : '—', price: fd(c.p), value: fd(value),
      pnl: pct === null ? '—' : (pct >= 0 ? '+' : '') + f(pct) + '%', pc: pct === null ? '' : (pct >= 0 ? 'b-ok' : 'b-no')
    };
  });
  renderRows('#assets', '#assets-empty', 'tpl-asset', cards, {});
  $$('#assets > .asset').forEach((el, i) => {
    el.addEventListener('click', () => { location.href = 'trade.html?coin=' + cards[i].s; });
  });

  // توزيع المحفظة: النقد + كل عملة
  const parts = [{ label: t('lbl_cash'), value: u.bal, color: '#94a3b8' }].concat(
    owned.map(([s, qty], i) => ({ label: s, value: qty * coin(s).p, color: PALETTE[i % PALETTE.length] })));
  const segs = tv > 0
    ? parts.filter((p) => p.value > 0).map((p) => ({ ...p, width: (p.value / tv * 100) + '%', label: p.label + ' ' + f(p.value / tv * 100) + '%' }))
    : [];
  renderRows('#alloc', null, 'tpl-seg', segs, {});
  renderRows('#legend', null, 'tpl-legend', segs, {});
}

/* ===== history.html ===== */
async function historyInit() {
  renderRows('#txs', '#txs-empty', 'tpl-tx', S.tx.map((x) => ({ d: x.d, t: x.t, amt: x.amt, note: x.note })), {});

  const snap = await db.ref('requests/' + S.uid).get();
  const list = Object.values(snap.val() || {}).sort((a, b) => b.ts - a.ts);
  renderRows('#reqs', '#reqs-empty', 'tpl-myreq', list.map((r) => ({
    d: r.d, type: t('type_' + r.type), amount: f(r.amount), method: r.method,
    label: t('st_' + r.status), cls: REQUEST_CLASS[r.status] || '', note: r.note || ''
  })), {});
}

/* ===== add_money.html و directing_money.html ===== */
function copyAdminId() {
  const done = () => toast('ok_copied');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ADMIN_ID).then(done, () => { $('#aid').select(); document.execCommand('copy'); done(); });
  } else {
    $('#aid').select();
    document.execCommand('copy');
    done();
  }
}

// إرسال طلب إيداع أو سحب — لا يتغير الرصيد إلا بموافقة الأدمن
async function doMoney(isDeposit) {
  const u = S.user;
  const v = (id) => $('#' + id).value.trim();
  const amount = parseFloat($('#amt').value);

  if (!(amount > 0)) return toast('err_amount');
  if (amount < MIN_AMOUNT) return toast('err_min', { min: fd(MIN_AMOUNT) });

  const error = checkBaridi('');
  if (error) return toast(error);
  if (v('num').length < 3) return toast('err_num');

  try {
    if (!isDeposit) {
      const snap = await db.ref('requests/' + S.uid).get();
      const pending = Object.values(snap.val() || {})
        .filter((r) => r.status === 'pending' && r.type === 'withdraw')
        .reduce((sum, r) => sum + r.amount, 0);
      if (amount > u.bal - pending) return toast('err_pending_withdraw');
    }

    await Promise.all([
      db.ref('requests/' + S.uid).push({
        uid: S.uid, name: u.name, email: u.email,
        type: isDeposit ? 'deposit' : 'withdraw',
        amount, method: 'Baridi',
        holder: v('fn') + ' ' + v('ln'),
        masked: t('mask_rip') + v('rip').slice(-4),
        numero: v('num'),
        status: 'pending', d: nowText(), ts: Date.now()
      }),
      logAction(t(isDeposit ? 'log_req_dep' : 'log_req_wd'), fd(amount))
    ]);

    flash('flash_request');
    location.href = 'history.html';
  } catch (err) {
    fail(err, 'f_send');
  }
}

/* ===== transfer.html ===== */
let RECIPIENT = null;

function transferInit() {
  const to = new URLSearchParams(location.search).get('to');
  if (to) { $('#tid').value = to; lookupRecipient(); }
}

async function lookupRecipient() {
  RECIPIENT = null;
  const pid = $('#tid').value.trim();
  const out = $('#tn');
  out.className = '';
  $('#tn-vb').className = 'vb';
  if (pid.length < 8) { out.textContent = ''; return; }
  if (!/^\d{8}$/.test(pid)) { out.textContent = t('rcp_invalid'); return; }
  if (pid === S.user.pid) { out.textContent = t('rcp_self'); return; }

  out.textContent = t('rcp_searching');
  try {
    const uid = (await db.ref('ids/' + pid).get()).val();
    if (!uid) { out.className = 'dn'; out.textContent = t('rcp_none'); return; }
    const d = (await db.ref('directory/' + uid).get()).val() || {};
    RECIPIENT = { uid, pid, name: d.name || t('rcp_user') };
    $('#tn-vb').className = 'vb ' + badgeClass(d.badge);
    out.className = 'up';
    out.textContent = t('rcp_found', { name: RECIPIENT.name });
  } catch (err) {
    out.textContent = t('rcp_fail');
  }
}

async function doTransfer() {
  const u = S.user;
  const amount = parseFloat($('#ta').value);

  if (!RECIPIENT) return toast('err_recipient');
  if (!(amount > 0)) return toast('err_amount');
  if (amount < MIN_AMOUNT) return toast('err_min', { min: fd(MIN_AMOUNT) });
  if (amount > u.bal) return toast('err_funds');
  if (!confirm(t('confirm_transfer', { amount: fd(amount), name: RECIPIENT.name, pid: RECIPIENT.pid }))) return;

  const key = db.ref('transfers/' + RECIPIENT.uid).push().key;
  const inc = firebase.database.ServerValue.increment;

  try {
    // خصم من رصيدك وإضافة لرصيد المستلم وتسجيل التحويل: كلها في عملية واحدة
    await db.ref().update({
      ['users/' + S.uid + '/bal']: inc(-amount),
      ['users/' + RECIPIENT.uid + '/bal']: inc(amount),
      [`transfers/${RECIPIENT.uid}/${key}`]: {
        from: S.uid, fromName: u.name, fromPid: u.pid, amount,
        note: $('#tnote').value.trim().slice(0, 80),
        status: 'credited', d: nowText(), ts: Date.now()
      }
    });
    u.bal -= amount;
    await addTx(t('tx_sent'), '-' + f(amount), t('note_to', { name: RECIPIENT.name, pid: RECIPIENT.pid }));
    flash('flash_transfer');
    location.href = 'history.html';
  } catch (err) {
    fail(err, 'f_transfer');
  }
}

/* ===== friends.html و messages.html (بيانات مشتركة) ===== */
const NET = { adminUid: null, friends: {}, reqs: {}, inbox: {}, dir: {} };

/* ===== friends.html ===== */
function friendsInit() {
  db.ref('meta/adminUid').get().then((s) => { NET.adminUid = s.val(); });
  db.ref('friends/' + S.uid).on('value', async (s) => {
    NET.friends = s.val() || {};
    await loadBadges(Object.keys(NET.friends));
    renderFriends();
  });
  db.ref('friendReq/' + S.uid).on('value', async (s) => {
    NET.reqs = s.val() || {};
    await loadBadges(Object.keys(NET.reqs));
    renderFriendRequests();
  });
}

async function sendFriendRequest() {
  const pid = $('#fid').value.trim();
  if (!/^\d{8}$/.test(pid)) return toast('err_id');
  if (pid === S.user.pid) return toast('err_self');

  try {
    const uid = (await db.ref('ids/' + pid).get()).val();
    if (!uid) return toast('err_no_account');
    if (uid === NET.adminUid) return toast('err_is_admin');
    if (NET.friends[uid]) return toast('err_already_friend');
    if (NET.reqs[uid]) return acceptRequest(uid);   // هو أرسل لك طلباً: نقبله مباشرة

    await db.ref(`friendReq/${uid}/${S.uid}`).set({
      fromName: S.user.name, fromPid: S.user.pid, status: 'pending', ts: Date.now()
    });
    $('#fid').value = '';
    toast('ok_friend_sent');
  } catch (err) {
    toast('err_friend_send');
  }
}

function renderFriendRequests() {
  const items = Object.entries(NET.reqs).map(([uid, r]) => ({ uid, name: r.fromName, pid: r.fromPid, vb: badgeClass(BADGES[uid]) }));
  renderRows('#reqs', '#reqs-empty', 'tpl-freq', items, {
    accept: (d) => acceptRequest(d.uid),
    reject: (d) => rejectRequest(d.uid)
  });
}

async function acceptRequest(fromUid) {
  const r = NET.reqs[fromUid];
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
    toast('ok_friends');
  } catch (err) {
    fail(err, 'f_accept');
  }
}

async function rejectRequest(fromUid) {
  try {
    await db.ref(`friendReq/${S.uid}/${fromUid}`).remove();
    toast('ok_req_rejected');
  } catch (err) {
    fail(err, 'f_reject');
  }
}

function renderFriends() {
  const items = Object.entries(NET.friends)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([uid, d]) => ({ uid, name: d.name, pid: d.pid, vb: badgeClass(BADGES[uid]) }));
  renderRows('#friends', '#friends-empty', 'tpl-friend', items, {
    chat: (d) => { location.href = 'messages.html?chat=' + d.uid; },
    pay: (d) => { location.href = 'transfer.html?to=' + d.pid; }
  });
}

/* ===== messages.html ===== */
const CHAT = { other: null, ref: null, name: '', pid: '' };

async function messagesInit() {
  NET.adminUid = (await db.ref('meta/adminUid').get()).val();
  if (S.isAdmin) {   // الأدمن وحده يقرأ كل الحسابات وعلاماتهم
    NET.dir = (await db.ref('directory').get()).val() || {};
    Object.entries(NET.dir).forEach(([u, d]) => { BADGES[u] = d.badge || ''; });
  }
  NET.friends = (await db.ref('friends/' + S.uid).get()).val() || {};
  await loadBadges(Object.keys(NET.friends));

  db.ref('friends/' + S.uid).on('value', async (s) => {
    NET.friends = s.val() || {};
    await loadBadges(Object.keys(NET.friends));
    renderContacts();
  });
  db.ref('inbox/' + S.uid).on('value', async (s) => {
    NET.inbox = s.val() || {};
    await loadBadges(Object.keys(NET.inbox));
    renderContacts();
  });

  // فتح محادثة مباشرة من رابط مثل messages.html?chat=UID&name=..&pid=..
  const params = new URLSearchParams(location.search);
  if (params.get('chat')) openChat(params.get('chat'), params.get('name') || '', params.get('pid') || '');
}

// الأدمن: كل الحسابات | غيره: الرئيس مثبّت أولاً ثم الأصدقاء ومن راسلتَه أو راسلك
function contactList() {
  const q = $('#q').value.trim().toLowerCase();
  let items;

  if (S.isAdmin) {
    items = Object.entries(NET.dir)
      .filter(([uid]) => uid !== S.uid)
      .map(([uid, d]) => ({ uid, name: d.name || d.user || '—', pid: d.pid, pinned: false }));
  } else {
    const byUid = {};
    Object.entries(NET.friends).forEach(([uid, d]) => { byUid[uid] = { uid, name: d.name, pid: d.pid, pinned: false }; });
    Object.entries(NET.inbox).forEach(([uid, d]) => {
      if (uid !== NET.adminUid && !byUid[uid]) byUid[uid] = { uid, name: d.name || '—', pid: d.pid, pinned: false };
    });
    items = Object.values(byUid);
    items.push({ uid: NET.adminUid, name: t('president'), pid: ADMIN_ID, pinned: true });
  }

  items.forEach((i) => { i.last = (NET.inbox[i.uid] || {}).ts || 0; });

  return items
    .filter((i) => i.pinned || i.name.toLowerCase().includes(q) || String(i.pid || '').includes(q))
    .sort((a, b) => (b.pinned - a.pinned) || (b.last - a.last) || a.name.localeCompare(b.name));
}

function renderContacts() {
  const rows = contactList().map((c) => {
    const info = NET.inbox[c.uid] || {};
    return {
      uid: c.uid, name: c.name, pinned: c.pinned, unread: !!info.unread,
      vb: badgeClass(c.pinned ? 'red' : BADGES[c.uid]),
      sub: (c.pid ? 'ID ' + c.pid + ' — ' : '') + (info.text || '').slice(0, 30),
      cls: c.uid && c.uid === CHAT.other ? 'on' : ''
    };
  });
  renderRows('#contacts', null, 'tpl-contact', rows, { open: (d) => openChat(d.uid) });
}

function chatId(a, b) { return [a, b].sort().join('_'); }

function nameOf(uid) {
  if (uid === NET.adminUid) return t('president');
  const d = NET.friends[uid] || NET.dir[uid] || NET.inbox[uid] || {};
  return d.name || d.user || '—';
}

function openChat(uid, name, pid) {
  if (!uid) return;
  if (CHAT.ref) CHAT.ref.off();   // نوقف متابعة المحادثة السابقة

  CHAT.other = uid;
  CHAT.name = name || '';
  CHAT.pid = pid || '';
  $('#ct').textContent = (uid === NET.adminUid ? '📌 ' : '') + (name || nameOf(uid));
  $('#cm').innerHTML = '';
  $('#cf').hidden = false;

  CHAT.ref = db.ref('chats/' + chatId(S.uid, uid));
  CHAT.ref.on('child_added', (snap) => {
    const m = snap.val();
    $('#cm').append(clone('tpl-msg', { text: m.text, time: m.d, cls: m.from === S.uid ? 'me' : 'them' }));
    $('#cm').scrollTop = $('#cm').scrollHeight;
  });

  if (NET.inbox[uid]) db.ref(`inbox/${S.uid}/${uid}/unread`).set(false);   // مقروءة
  renderContacts();
}

// إرسال رسالة خاصة (تُستعمل أيضاً لرسالة طلب الشراء التلقائية في P2P)
async function deliverMessage(other, text, otherName, otherPid) {
  const now = Date.now();
  await db.ref('chats/' + chatId(S.uid, other)).push({ from: S.uid, to: other, text, ts: now, d: nowText() });
  await Promise.all([
    db.ref(`inbox/${S.uid}/${other}`).set({ text, ts: now, unread: false, name: otherName || '', pid: otherPid || '' }),
    db.ref(`inbox/${other}/${S.uid}`).set({ text, ts: now, unread: true, name: S.isAdmin ? t('president') : S.user.name, pid: S.user.pid || '' })
  ]);
}

async function sendMessage() {
  const text = $('#mt').value.trim();
  if (!text || !CHAT.other) return;
  $('#mt').value = '';
  try {
    await deliverMessage(CHAT.other, text, CHAT.name || nameOf(CHAT.other), CHAT.pid || (NET.friends[CHAT.other] || {}).pid || '');
  } catch (err) {
    toast('f_message');
  }
}

/* ===== setting.html ===== */
function settingInit() {
  const u = S.user;
  $('#un').value = u.user || '';
  $('#n').value = u.name || '';
  $('#ph').value = u.phone || '';
  $('#pc').value = u.post || '';
  $('#ad').value = u.addr || '';
  $('#em').value = u.email || '';
  $('#pidf').value = u.pid || '';
}

async function saveSettings() {
  const v = (id) => $('#' + id).value.trim();
  if (!v('n') || !v('un')) return toast('err_name_user');

  Object.assign(S.user, { user: v('un'), name: v('n'), phone: v('ph'), post: v('pc'), addr: v('ad') });

  try {
    await db.ref('users/' + S.uid).update({
      user: S.user.user, name: S.user.name, phone: S.user.phone, post: S.user.post, addr: S.user.addr
    });
    await db.ref('directory/' + S.uid).update({
      name: S.isAdmin ? t('president') : S.user.name, user: S.user.user, pid: S.user.pid
    });
    if ($('#p').value) {
      try { await auth.currentUser.updatePassword($('#p').value); }
      catch (err) { return toast('err_pw_relogin'); }
    }
    logAction(t('log_settings'), S.user.user);
    bindUser();
    toast('ok_saved');
  } catch (err) {
    fail(err, 'f_save');
  }
}

/* ===== admin.html ===== */
let ADMIN_REQ = {};     // 'uid/rid' -> الطلب
let ADMIN_USERS = {};   // uid -> بيانات الحساب
let ADMIN_BADGES = {};  // uid -> علامة الحساب

function adminInit() { loadAdminData(); }

async function loadAdminData() {
  try {
    const [usersSnap, txSnap, reqSnap, logsSnap, dirSnap] = await Promise.all([
      db.ref('users').get(),
      db.ref('tx').get(),
      db.ref('requests').get(),
      db.ref('logs').orderByChild('ts').limitToLast(300).get(),
      db.ref('directory').get()
    ]);

    const users = usersSnap.val() || {};
    const allTx = txSnap.val() || {};
    const allReq = reqSnap.val() || {};
    const logs = Object.values(logsSnap.val() || {}).sort((a, b) => b.ts - a.ts);

    ADMIN_USERS = users;
    ADMIN_BADGES = {};
    Object.entries(dirSnap.val() || {}).forEach(([u, d]) => { ADMIN_BADGES[u] = d.badge || ''; });
    ADMIN_REQ = {};
    Object.entries(allReq).forEach(([uid, list]) => {
      Object.entries(list).forEach(([rid, r]) => { ADMIN_REQ[uid + '/' + rid] = { ...r, uid, rid }; });
    });

    renderSummary(users);
    renderAdminRequests();
    renderAdminUsers(users);
    renderAdminTx(users, allTx);
    renderRows('#logs', null, 'tpl-log', logs.map((l) => ({ d: l.d, actor: l.actor, action: l.action, details: l.details })), {});
  } catch (err) {
    fail(err, 'f_load');
  }
}

function renderSummary(users) {
  const list = Object.values(users);
  const cash = list.reduce((sum, x) => sum + (x.bal || 0), 0);
  const all = list.reduce((sum, x) => sum + total({ bal: x.bal || 0, h: x.h || {} }), 0);
  bind('count', list.length);
  bind('cashall', fd(cash));
  bind('allsum', fd(all));
  bind('pending', Object.values(ADMIN_REQ).filter((r) => r.status === 'pending').length);
}

/* ---- طلبات الإيداع والسحب ---- */
function renderAdminRequests() {
  const order = { pending: 0, approved: 1, rejected: 2 };
  const items = Object.values(ADMIN_REQ)
    .sort((a, b) => (order[a.status] - order[b.status]) || (b.ts - a.ts))
    .slice(0, 100)
    .map((r) => ({
      ...r, amountText: fd(r.amount), typeText: t('type_' + r.type), tc: r.type === 'deposit' ? 'up' : 'dn',
      who: r.name, label: t('st_' + r.status), cls: REQUEST_CLASS[r.status] || '',
      detail: `${r.holder} — ${r.masked}`, numeroText: 'Numéro: ' + (r.numero || '-'),
      isPending: r.status === 'pending'
    }));

  renderRows('#adm-reqs', '#adm-reqs-empty', 'tpl-adm-req', items, {
    approve: (d) => adminDecide(d.uid, d.rid, true),
    reject: (d) => adminDecide(d.uid, d.rid, false)
  });
}

async function adminDecide(uid, rid, approve) {
  const req = ADMIN_REQ[uid + '/' + rid];
  if (!req) return;

  try {
    // نحجز الطلب أولاً حتى لا يُعالَج مرتين
    const claim = await claimStatus(db.ref(`requests/${uid}/${rid}/status`), 'pending', approve ? 'approved' : 'rejected');
    if (!claim.committed) { toast('err_processed'); return loadAdminData(); }

    if (approve) {
      const sign = req.type === 'deposit' ? 1 : -1;
      const result = await changeBalance(uid, sign * req.amount);

      if (!result.committed) {   // رصيد غير كافٍ للسحب
        await db.ref(`requests/${uid}/${rid}`).update({ status: 'rejected', note: t('note_insufficient') });
        toast('err_user_funds');
        return loadAdminData();
      }

      await db.ref('tx/' + uid).push({
        t: t('type_' + req.type), amt: (sign > 0 ? '+' : '-') + f(req.amount),
        note: t('note_approved', { method: req.method }), d: nowText(), ts: Date.now()
      });
      if (uid === S.uid) S.user.bal = result.snapshot.val();
    }

    await logAction(t(approve ? 'log_approve' : 'log_reject'), `${t('type_' + req.type)} ${fd(req.amount)} — ${req.email}`);
    toast(approve ? 'ok_approved' : 'ok_rejected');
    bindUser();
    loadAdminData();
  } catch (err) {
    fail(err, 'f_exec');
  }
}

/* ---- الحسابات ---- */
function renderAdminUsers(users) {
  const items = Object.entries(users).map(([uid, x]) => ({
    uid, pid: x.pid || '-', user: x.user, name: x.name, email: x.email, phone: x.phone, wil: x.wil,
    pay: x.pm ? x.pm.t + ' ' + x.pm.k : '',
    assets: Object.entries(x.h || {}).filter(([, q]) => q > 0).map(([s, q]) => `${s} ${q.toFixed(4)}`).join(', ') || '-',
    cash: fd(x.bal || 0), tot: fd(total({ bal: x.bal || 0, h: x.h || {} })),
    canDelete: uid !== S.uid,
    vb: badgeClass(uid === S.uid ? 'red' : ADMIN_BADGES[uid]),
    canVerify: uid !== S.uid,
    vlabel: t(ADMIN_BADGES[uid] === 'blue' ? 'btn_unverify' : 'btn_verify')
  }));

  renderRows('#adm-users', null, 'tpl-adm-user', items, {
    plus: (d, ev) => adminAdjust(d.uid, 1, ev),
    minus: (d, ev) => adminAdjust(d.uid, -1, ev),
    edit: (d) => adminEdit(d.uid),
    reset: (d) => adminReset(d.email),
    verify: (d) => adminToggleVerify(d.uid),
    del: (d) => adminDelete(d.uid)
  });
}

// إضافة أو سحب رصيد مباشرة (sign: 1 إضافة، -1 سحب)
async function adminAdjust(uid, sign, ev) {
  const input = ev.target.closest('tr').querySelector('input');
  const amount = parseFloat(input.value);
  if (!(amount > 0)) return toast('err_amount');

  try {
    const result = await changeBalance(uid, sign * amount);
    if (!result.committed) return toast('err_no_funds_withdraw');

    const label = t(sign > 0 ? 'tx_admin_dep' : 'tx_admin_wd');
    await Promise.all([
      db.ref('tx/' + uid).push({ t: label, amt: (sign > 0 ? '+' : '-') + f(amount), note: t('note_admin'), d: nowText(), ts: Date.now() }),
      logAction(label, `${fd(amount)} — ${uid}`)
    ]);

    if (uid === S.uid) S.user.bal = result.snapshot.val();
    input.value = '';
    toast('ok_done');
    bindUser();
    loadAdminData();
  } catch (err) {
    fail(err, 'f_exec');
  }
}

async function adminReset(email) {
  if (!email) return toast('err_no_email');
  try {
    await auth.sendPasswordResetEmail(email);
    await logAction(t('log_reset_pw'), email);
    toast('ok_reset_sent', { email });
  } catch (err) {
    fail(err, 'f_send');
  }
}

async function adminDelete(uid) {
  if (!confirm(t('confirm_delete_acc'))) return;
  try {
    const pid = ADMIN_USERS[uid] && ADMIN_USERS[uid].pid;
    await removeUserListings(uid);
    await Promise.all([
      ...['users', 'tx', 'requests', 'directory', 'inbox', 'friends', 'friendReq', 'transfers', 'userBots', 'favorites', 'orders'].map((n) => db.ref(n + '/' + uid).remove()),
      pid ? db.ref('ids/' + pid).remove() : null
    ]);
    await logAction(t('log_delete_acc'), uid);
    toast('ok_deleted');
    loadAdminData();
  } catch (err) {
    fail(err, 'f_delete');
  }
}

// توثيق حساب (علامة زرقاء) أو إلغاء توثيقه
async function adminToggleVerify(uid) {
  const wasOn = ADMIN_BADGES[uid] === 'blue';
  try {
    const ref = db.ref('directory/' + uid + '/badge');
    await (wasOn ? ref.remove() : ref.set('blue'));
    await logAction(t(wasOn ? 'log_unverify' : 'log_verify'), (ADMIN_USERS[uid] || {}).email || uid);
    toast(wasOn ? 'ok_unverified' : 'ok_verified');
    loadAdminData();
  } catch (err) {
    fail(err, 'f_exec');
  }
}

/* ---- تعديل حساب ---- */
function adminEdit(uid) {
  const x = ADMIN_USERS[uid];
  if (!x) return;
  $('#eb').dataset.uid = uid;
  $('#eb-email').textContent = x.email || '';
  $('#ed-n').value = x.name || '';
  $('#ed-u').value = x.user || '';
  $('#ed-ph').value = x.phone || '';
  $('#ed-p').value = x.pid || '';
  $('#ed-w').value = x.wil || '';
  $('#ed-pc').value = x.post || '';
  $('#ed-a').value = x.addr || '';
  $('#eb').hidden = false;
  $('#eb').scrollIntoView({ behavior: 'smooth' });
}

async function adminSaveEdit() {
  const uid = $('#eb').dataset.uid;
  const x = ADMIN_USERS[uid];
  const v = (id) => $('#' + id).value.trim();
  const newPid = v('ed-p');

  if (!v('ed-n') || v('ed-u').length < 3) return toast('err_name_user');
  if (!/^\d{8}$/.test(newPid)) return toast('err_id');

  try {
    // تغيير الـ ID: نحجز الجديد (يجب أن يكون غير مستعمل) ثم نحرّر القديم
    if (newPid !== x.pid) {
      const claim = await db.ref('ids/' + newPid).transaction((cur) => (cur === null ? uid : undefined));
      if (!claim.committed) return toast('err_id_taken');
      if (x.pid) await db.ref('ids/' + x.pid).remove();
    }

    const changes = { name: v('ed-n'), user: v('ed-u'), phone: v('ed-ph'), pid: newPid, wil: v('ed-w'), post: v('ed-pc'), addr: v('ed-a') };
    await db.ref('users/' + uid).update(changes);
    await db.ref('directory/' + uid).update({ name: uid === S.uid ? t('president') : changes.name, user: changes.user, pid: newPid });
    await logAction(t('log_edit_acc'), `${x.email} (ID ${newPid})`);

    if (uid === S.uid) Object.assign(S.user, changes);
    $('#eb').hidden = true;
    toast('ok_edit');
    bindUser();
    loadAdminData();
  } catch (err) {
    fail(err, 'f_save');
  }
}

/* ---- إنشاء حساب جديد ---- */
async function adminCreateAccount() {
  const v = (id) => $('#' + id).value.trim();
  const balance = parseFloat($('#nb').value) || 0;

  if (v('nu').length < 3) return toast('err_user');
  if (!v('nm')) return toast('err_fullname');
  if (!/^\S+@\S+\.\S+$/.test(v('ne'))) return toast('err_email');
  if (v('npw').length < 6) return toast('err_pass_len');
  if (v('nph') && !/^0[567]\d{8}$/.test(v('nph'))) return toast('err_phone');
  if (balance < 0) return toast('err_balance');

  try {
    // تطبيق Firebase ثانوي حتى لا يُسجَّل خروج الأدمن
    const secondary = firebase.apps.find((a) => a.name === 'secondary') || firebase.initializeApp(firebaseConfig, 'secondary');
    const cred = await secondary.auth().createUserWithEmailAndPassword(v('ne'), v('npw'));
    const uid = cred.user.uid;
    await secondary.auth().signOut();

    const profile = {
      pid: await claimId(uid), user: v('nu'), name: v('nm'), email: v('ne'), phone: v('nph'),
      bal: balance, created: Date.now(), createdBy: 'admin'
    };
    await db.ref('users/' + uid).set(profile);
    await db.ref('directory/' + uid).update({ name: profile.name, user: profile.user, pid: profile.pid });

    if (balance > 0) {
      await db.ref('tx/' + uid).push({ t: t('tx_admin_dep'), amt: '+' + f(balance), note: t('note_initial'), d: nowText(), ts: Date.now() });
    }
    await logAction(t('log_create_acc'), `${v('ne')} — ${fd(balance)}`);

    ['nu', 'nm', 'ne', 'npw', 'nph'].forEach((id) => { $('#' + id).value = ''; });
    $('#nb').value = 0;
    toast('ok_created');
    loadAdminData();
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') return toast('email_taken');
    fail(err, 'f_create');
  }
}

/* ---- سجل المعاملات ---- */
function renderAdminTx(users, allTx) {
  const rows = [];
  Object.entries(allTx).forEach(([uid, list]) => {
    Object.values(list).forEach((x) => rows.push({ ...x, who: users[uid] ? users[uid].name : '—' }));
  });
  rows.sort((a, b) => b.ts - a.ts);
  renderRows('#adm-tx', null, 'tpl-adm-tx', rows.slice(0, 300).map((x) => ({ who: x.who, d: x.d, t: x.t, amt: x.amt, note: x.note })), {});
}

/* ---- حذف كل الحسابات وإبقاء الأدمن ---- */
async function adminPurge() {
  if (!confirm(t('confirm_purge'))) return;
  if (prompt(t('prompt_delete')) !== 'DELETE') return toast('ok_cancelled');

  try {
    const [usersSnap, idsSnap] = await Promise.all([db.ref('users').get(), db.ref('ids').get()]);
    const nodes = ['users', 'tx', 'requests', 'directory', 'inbox', 'friends', 'friendReq', 'transfers', 'userBots', 'favorites', 'orders'];
    const updates = { chats: null, p2p: null, p2pComments: null };

    Object.keys(usersSnap.val() || {}).forEach((uid) => {
      if (uid === S.uid) return;
      nodes.forEach((n) => { updates[n + '/' + uid] = null; });
    });
    ['inbox', 'friends', 'friendReq', 'transfers', 'userBots', 'favorites', 'orders'].forEach((n) => { updates[n + '/' + S.uid] = null; });
    Object.entries(idsSnap.val() || {}).forEach(([pid, uid]) => { if (uid !== S.uid) updates['ids/' + pid] = null; });

    await db.ref().update(updates);
    await logAction(t('log_purge'), '');
    toast('ok_purged');
    loadAdminData();
  } catch (err) {
    fail(err, 'f_delete');
  }
}

/* ===== admin_trade.html ===== */
function adminTradeInit() { renderCoinEditor(); }

function renderCoinEditor() {
  const box = $('#coin-edit');
  box.innerHTML = '';
  COINS.forEach((c) => {
    const row = clone('tpl-coin-edit', { s: c.s, p: fd(c.p), n: c.n, base: c.basePrice, min: c.min, max: c.max },
      { del: () => deleteCoin(c.s) });
    row.dataset.sym = c.s;
    box.append(row);
  });
  $('#coin-edit-empty').hidden = COINS.length > 0;
  $('#coin-actions').hidden = COINS.length === 0;
}

// الحد الأدنى والأقصى يجب أن يكونا صحيحين: الأدنى أكبر من -100 والأقصى أكبر من الأدنى
const validRange = (lo, hi) => lo > -100 && hi > lo;

async function saveCoins() {
  const data = {};
  let valid = true;

  $$('#coin-edit [data-sym]').forEach((row) => {
    const sym = row.dataset.sym, c = coin(sym);
    const val = (role) => $(`[data-role="${role}"]`, row).value;
    const lo = parseFloat(val('mn')), hi = parseFloat(val('mx'));
    if (!validRange(lo, hi)) valid = false;
    data[sym] = { n: val('n').trim() || c.n, p: parseFloat(val('p')) || c.basePrice, min: lo, max: hi };
  });
  if (!valid) return toast('err_range');

  try {
    await db.ref('coins').set(data);
    logAction(t('log_coins_edit'), Object.keys(data).join(', '));
    toast('ok_saved');
    setTimeout(renderCoinEditor, 400);
  } catch (err) {
    fail(err, 'f_exec');
  }
}

async function addCoin() {
  const symbol = $('#ns').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const price = parseFloat($('#np').value);
  const lo = parseFloat($('#nmin').value), hi = parseFloat($('#nmax').value);

  if (!symbol || !(price > 0) || coin(symbol)) return toast('err_coin');
  if (!validRange(lo, hi)) return toast('err_range');

  try {
    await db.ref('coins/' + symbol).set({ n: $('#nn').value.trim() || symbol, p: price, min: lo, max: hi });
    logAction(t('log_coin_add'), symbol);
    ['ns', 'nn', 'np'].forEach((id) => { $('#' + id).value = ''; });
    setTimeout(renderCoinEditor, 400);
  } catch (err) {
    fail(err, 'f_exec');
  }
}

async function deleteCoin(symbol) {
  if (!confirm(t('confirm_delete_coin', { sym: symbol }))) return;
  try {
    await db.ref('coins/' + symbol).remove();
    logAction(t('log_coin_del'), symbol);
    toast('ok_deleted');
    setTimeout(renderCoinEditor, 400);
  } catch (err) {
    fail(err, 'f_delete');
  }
}

async function deleteAllCoins() {
  if (!confirm(t('confirm_delete_coins'))) return;
  try {
    await db.ref('coins').remove();
    logAction(t('log_coins_del_all'), '');
    toast('ok_deleted');
    setTimeout(renderCoinEditor, 400);
  } catch (err) {
    fail(err, 'f_delete');
  }
}


/* ===== bots.html: متجر البوتات ===== */
let BOTS = {};      // id -> { name, price, desc, ts }
let MY_BOTS = {};   // botId -> سجل الشراء

async function botsInit() {
  const [all, mine] = await Promise.all([db.ref('bots').get(), db.ref('userBots/' + S.uid).get()]);
  BOTS = all.val() || {};
  MY_BOTS = {};
  Object.entries(mine.val() || {}).forEach(([key, r]) => { MY_BOTS[r.botId] = { ...r, key }; });
  renderBots();
}

function renderBots() {
  const items = Object.entries(BOTS)
    .sort(([, a], [, b]) => b.ts - a.ts)
    .map(([id, b]) => ({ id, name: b.name, desc: b.desc, price: fd(b.price), owned: !!MY_BOTS[id], canBuy: !MY_BOTS[id] }));
  renderRows('#bots', '#bots-empty', 'tpl-bot', items, { buy: (d) => buyBot(d.id) });

  const mine = Object.values(MY_BOTS).sort((a, b) => b.ts - a.ts).map((r) => ({
    key: r.key, botId: r.botId, name: r.name, rawPrice: r.price, price: fd(r.price), resale: fd(r.price / 2), d: r.d
  }));
  renderRows('#mybots', '#mybots-empty', 'tpl-mybot', mine, { sell: (d) => sellBot(d) });
}

async function buyBot(id) {
  const bot = BOTS[id];
  if (!bot) return;
  if (MY_BOTS[id]) return toast('err_bot_owned');
  if (S.user.bal < bot.price) return toast('err_funds');
  if (!confirm(t('confirm_buy_bot', { name: bot.name, price: fd(bot.price) }))) return;

  const key = db.ref('userBots/' + S.uid).push().key;
  const record = { botId: id, name: bot.name, price: bot.price, d: nowText(), ts: Date.now() };

  try {
    // خصم السعر وتسجيل الشراء في عملية واحدة
    await db.ref().update({
      ['users/' + S.uid + '/bal']: firebase.database.ServerValue.increment(-bot.price),
      [`userBots/${S.uid}/${key}`]: record
    });
    S.user.bal -= bot.price;
    await addTx(t('tx_bot'), '-' + f(bot.price), t('note_bot', { name: bot.name }));
    MY_BOTS[id] = { ...record, key };
    bindUser();
    renderBots();
    toast('ok_bot_bought');
  } catch (err) {
    fail(err, 'f_exec');
  }
}

// إعادة بيع البوت: يعود إليك نصف ثمن الشراء، ويُزال البوت من بوتاتك
async function sellBot(r) {
  const refund = r.rawPrice / 2;
  if (!confirm(t('confirm_sell_bot', { name: r.name, amount: fd(refund) }))) return;

  try {
    await db.ref().update({
      [`userBots/${S.uid}/${r.key}`]: null,
      ['users/' + S.uid + '/bal']: firebase.database.ServerValue.increment(refund)
    });
    S.user.bal += refund;
    await addTx(t('tx_bot_sell'), '+' + f(refund), t('note_bot', { name: r.name }));
    delete MY_BOTS[r.botId];
    bindUser();
    renderBots();
    toast('ok_bot_sold');
  } catch (err) {
    fail(err, 'f_exec');
  }
}

/* ===== admin_bots.html: إدارة البوتات (للأدمن) ===== */
async function adminBotsInit() {
  await loadAdminBots();
  await loadBuyers();
}

/* ---- مشترو البوتات: صف لكل عملية شراء بوت؛ إضافة رصيد أو نزعه ويُكتب في سجل المشتري اسم البوت الذي اشتراه ---- */
let BUYERS = {};   // 'uid/botId' -> بيانات الحساب + اسم البوت

async function loadBuyers() {
  try {
    const [bought, usersSnap] = await Promise.all([db.ref('userBots').get(), db.ref('users').get()]);
    const users = usersSnap.val() || {};
    BUYERS = {};
    Object.entries(bought.val() || {}).forEach(([uid, recs]) => {
      if (!users[uid]) return;
      Object.values(recs).forEach((r) => { BUYERS[uid + '/' + r.botId] = { ...users[uid], uid, botName: r.name }; });
    });
    renderBuyers();
  } catch (err) {
    fail(err, 'f_load');
  }
}

function renderBuyers() {
  const items = Object.values(BUYERS).map((b) => ({
    uid: b.uid, name: b.name, email: b.email, pid: b.pid || '-', bots: b.botName, botName: b.botName, cash: fd(b.bal || 0)
  }));
  renderRows('#buyers', '#buyers-empty', 'tpl-buyer', items, {
    plus: (d, ev) => botMoney(d, 1, ev),
    minus: (d, ev) => botMoney(d, -1, ev)
  });
}

// sign: 1 إضافة رصيد، -1 نزع رصيد (لا يقبل رصيداً سالباً)
async function botMoney(d, sign, ev) {
  const input = ev.target.closest('tr').querySelector('input');
  const amount = parseFloat(input.value);
  if (!(amount > 0)) return toast('err_amount');

  try {
    const result = await changeBalance(d.uid, sign * amount);
    if (!result.committed) return toast('err_no_funds_withdraw');

    const label = t(sign > 0 ? 'tx_bot_add' : 'tx_bot_remove');
    await Promise.all([
      db.ref('tx/' + d.uid).push({ t: label, amt: (sign > 0 ? '+' : '-') + f(amount), note: d.botName, d: nowText(), ts: Date.now() }),
      logAction(label, `${d.email} — ${d.botName} — ${fd(amount)}`)
    ]);

    if (d.uid === S.uid) S.user.bal = result.snapshot.val();
    input.value = '';
    toast('ok_done');
    bindUser();
    loadBuyers();
  } catch (err) {
    fail(err, 'f_exec');
  }
}

async function loadAdminBots() {
  try {
    BOTS = (await db.ref('bots').get()).val() || {};
    const items = Object.entries(BOTS)
      .sort(([, a], [, b]) => b.ts - a.ts)
      .map(([id, b]) => ({ id, name: b.name, desc: b.desc, price: fd(b.price) }));
    renderRows('#adm-bots', '#adm-bots-empty', 'tpl-adm-bot', items, { del: (d) => deleteBot(d.id) });
  } catch (err) {
    fail(err, 'f_load');
  }
}

async function addBot() {
  const name = $('#bot-name').value.trim();
  const price = parseFloat($('#bot-price').value);
  if (!name || !(price > 0)) return toast('err_bot');

  try {
    const key = db.ref('bots').push().key;
    await db.ref('bots/' + key).set({ name, price, desc: $('#bot-desc').value.trim(), ts: Date.now() });
    logAction(t('log_bot_add'), `${name} — ${fd(price)}`);
    ['bot-name', 'bot-price', 'bot-desc'].forEach((id) => { $('#' + id).value = ''; });
    toast('ok_bot_added');
    loadAdminBots();
  } catch (err) {
    fail(err, 'f_exec');
  }
}

async function deleteBot(id) {
  if (!confirm(t('confirm_delete_bot'))) return;
  try {
    await db.ref('bots/' + id).remove();
    logAction(t('log_bot_del'), (BOTS[id] || {}).name || id);
    toast('ok_deleted');
    loadAdminBots();
  } catch (err) {
    fail(err, 'f_delete');
  }
}


/* ===== p2p.html: سوق بين المستخدمين =====
   تبيع عملة تملكها بسعر تحدده (DZD)، وتُحجز كميتها إلى أن يشتريها أحد أو تلغي المنشور. */
let P2P = {};   // id -> المنشور

// عملات تملكها فقط
function fillP2pCoins() {
  $('#p2p-coin').innerHTML = Object.entries(S.user.h)
    .filter(([s, q]) => q > 0 && coin(s))
    .map(([s, q]) => `<option value="${s}">${s} — ${q.toFixed(4)}</option>`).join('');
}

// الحد الأدنى للكمية: ما قيمته الحالية MIN_AMOUNT (أو كل ما تملكه إن كان أقل)
function p2pMinQty(sym) {
  const c = coin(sym), owned = S.user.h[sym] || 0;
  return c ? Math.min(owned, Math.ceil((MIN_AMOUNT / c.p) * 1e6) / 1e6) : 0;
}

// Min / Max للكمية
function fillP2pQty(useMax) {
  const sym = $('#p2p-coin').value;
  const owned = Math.floor((S.user.h[sym] || 0) * 1e6) / 1e6;
  $('#p2p-qty').value = useMax ? owned : p2pMinQty(sym);
}

function p2pInit() {
  fillP2pCoins();
  db.ref('p2p').on('value', async (snap) => {
    P2P = snap.val() || {};
    await loadBadges([...new Set(Object.values(P2P).map((l) => l.uid))]);
    renderP2p();
  });
}

function renderP2p() {
  const q = $('#p2p-q').value.trim().toLowerCase();
  const items = Object.entries(P2P)
    .filter(([, l]) => l.status === 'open')
    .filter(([, l]) => !q || l.sym.toLowerCase().includes(q) || String(l.name || '').toLowerCase().includes(q) ||
      String((coin(l.sym) || {}).n || '').toLowerCase().includes(q))
    .sort(([, a], [, b]) => b.ts - a.ts)
    .map(([id, l]) => ({
      id, uid: l.uid, ab: l.sym.slice(0, 3), sym: l.sym, cname: (coin(l.sym) || {}).n || l.sym,
      qty: Number(l.qty).toFixed(6), price: fd(l.price), name: l.name, pid: l.pid, note: l.note || '',
      vb: badgeClass(BADGES[l.uid]), mine: l.uid === S.uid, canBuy: l.uid !== S.uid
    }));
  renderRows('#p2p-list', '#p2p-empty', 'tpl-p2p', items, {
    buy: (d) => buyP2p(d.id),
    cancel: (d) => cancelP2p(d.id),
    chat: (d) => { location.href = `messages.html?chat=${d.uid}&name=${encodeURIComponent(d.name)}&pid=${d.pid}`; },
    comments: (d, ev) => loadComments(d.id, ev.target.closest('.p2p')),
    sendcomment: (d, ev) => sendComment(d.id, ev.target.closest('.p2p'))
  });
}

// نشر عرض بيع: تُحجز العملات من رصيدك إلى أن يشتريها أحد أو تلغي العرض
async function postP2p() {
  const u = S.user;
  const sym = $('#p2p-coin').value;
  let qty = parseFloat($('#p2p-qty').value);
  const price = parseFloat($('#p2p-price').value);
  const owned = u.h[sym] || 0;

  if (!sym) return toast('err_no_owned');
  if (!(qty > 0)) return toast('err_amount');
  if (qty > owned + 1e-6) return toast('err_coin_qty');
  if (qty >= owned - 1e-6) qty = owned;   // بيع كل ما تملك
  if (qty < p2pMinQty(sym) - 1e-9) return toast('err_qty_min', { min: p2pMinQty(sym) });
  if (!(price >= MIN_AMOUNT)) return toast('err_min', { min: fd(MIN_AMOUNT) });

  const takeCost = owned > 0 ? (u.cost[sym] || 0) * Math.min(1, qty / owned) : 0;
  const newH = { ...u.h, [sym]: Math.max(0, owned - qty) };
  const newCost = { ...u.cost, [sym]: Math.max(0, (u.cost[sym] || 0) - takeCost) };
  if (newH[sym] < 1e-9) { newH[sym] = 0; newCost[sym] = 0; }

  const key = db.ref('p2p').push().key;
  const listing = {
    uid: S.uid, name: u.name, pid: u.pid || '', sym, qty, price, cost: takeCost,
    note: $('#p2p-note').value.trim().slice(0, 100), status: 'open', d: nowText(), ts: Date.now()
  };

  try {
    await db.ref().update({
      ['users/' + S.uid + '/h']: newH,
      ['users/' + S.uid + '/cost']: newCost,
      ['p2p/' + key]: listing
    });
    u.h = newH;
    u.cost = newCost;
    logAction(t('log_p2p_post'), `${sym} ${qty} — ${fd(price)}`);
    ['p2p-qty', 'p2p-price', 'p2p-note'].forEach((id) => { $('#' + id).value = ''; });
    fillP2pCoins();
    toast('ok_p2p_posted');
  } catch (err) {
    fail(err, 'f_exec');
  }
}

async function buyP2p(id) {
  const l = P2P[id], u = S.user;
  if (!l || l.status !== 'open') return toast('err_listing_gone');
  if (l.uid === S.uid) return;
  if (u.bal < l.price) return toast('err_funds');
  if (!confirm(t('confirm_p2p_buy', { sym: l.sym, qty: Number(l.qty).toFixed(6), price: fd(l.price), name: l.name }))) return;

  try {
    // نحجز المنشور أولاً حتى لا يشتريه شخصان
    const claim = await claimStatus(db.ref('p2p/' + id + '/status'), 'open', 'sold');
    if (!claim.committed) return toast('err_listing_gone');

    const sym = l.sym, inc = firebase.database.ServerValue.increment;
    const key = db.ref('transfers/' + l.uid).push().key;
    const newQty = (u.h[sym] || 0) + l.qty, newCost = (u.cost[sym] || 0) + l.price;

    await db.ref().update({
      ['users/' + S.uid + '/bal']: inc(-l.price),
      ['users/' + l.uid + '/bal']: inc(l.price),
      ['users/' + S.uid + '/h/' + sym]: newQty,
      ['users/' + S.uid + '/cost/' + sym]: newCost,
      [`transfers/${l.uid}/${key}`]: {
        from: S.uid, fromName: u.name, fromPid: u.pid, amount: l.price, kind: 'p2p', sym, qty: l.qty,
        note: '', status: 'credited', d: nowText(), ts: Date.now()
      }
    });
    u.bal -= l.price;
    u.h[sym] = newQty;
    u.cost[sym] = newCost;
    await addTx(t('tx_p2p_buy'), '-' + f(l.price), t('note_p2p_buy', { sym, qty: Number(l.qty).toFixed(6), name: l.name }));
    bindUser();
    toast('ok_p2p_bought');
  } catch (err) {
    fail(err, 'f_exec');
  }
}

// إلغاء منشورك: تعود العملات المحجوزة إلى رصيدك
async function cancelP2p(id) {
  const l = P2P[id], u = S.user;
  if (!l || l.uid !== S.uid || l.status !== 'open') return;
  if (!confirm(t('confirm_p2p_cancel'))) return;

  try {
    const claim = await claimStatus(db.ref('p2p/' + id + '/status'), 'open', 'cancelled');
    if (!claim.committed) return toast('err_listing_gone');

    const sym = l.sym;
    const newQty = (u.h[sym] || 0) + l.qty, newCost = (u.cost[sym] || 0) + (l.cost || 0);
    await db.ref().update({ ['users/' + S.uid + '/h/' + sym]: newQty, ['users/' + S.uid + '/cost/' + sym]: newCost });
    u.h[sym] = newQty;
    u.cost[sym] = newCost;
    logAction(t('log_p2p_cancel'), l.sym);
    fillP2pCoins();
    toast('ok_p2p_cancelled');
  } catch (err) {
    fail(err, 'f_exec');
  }
}

/* ---- التعليقات: خانة تعليقات لكل منشور ---- */
function loadComments(id, card) {
  if (card.dataset.loaded) return;
  card.dataset.loaded = '1';
  const list = $('.cm-list', card);
  db.ref('p2pComments/' + id).on('child_added', async (snap) => {
    const c = snap.val();
    await loadBadges([c.uid]);
    list.append(clone('tpl-comment', { name: c.name, text: c.text, d: c.d, vb: badgeClass(BADGES[c.uid]) }));
  });
}

async function sendComment(id, card) {
  const input = $('[data-role="comment"]', card);
  const text = input.value.trim();
  if (!text) return;
  try {
    await db.ref('p2pComments/' + id).push({
      uid: S.uid, name: S.isAdmin ? t('president') : S.user.name, pid: S.user.pid || '',
      text: text.slice(0, 200), ts: Date.now(), d: nowText()
    });
    input.value = '';
  } catch (err) {
    fail(err, 'f_send');
  }
}

/* ===== admin_p2p.html: الأدمن ينزع منشوراً أو يعدّله ===== */
const P2P_CLASS = { open: 'b-ok', sold: 'b-pending', cancelled: 'b-no' };

function adminP2pInit() {
  db.ref('p2p').on('value', async (snap) => {
    P2P = snap.val() || {};
    await loadBadges([...new Set(Object.values(P2P).map((l) => l.uid))]);
    renderAdminP2p();
  });
}

function renderAdminP2p() {
  const items = Object.entries(P2P)
    .sort(([, a], [, b]) => b.ts - a.ts)
    .map(([id, l]) => ({
      id, d: l.d, name: l.name, pid: l.pid, vb: badgeClass(BADGES[l.uid]), sym: l.sym, qty: Number(l.qty).toFixed(6),
      priceRaw: l.price, note: l.note || '', status: t('p2p_' + l.status), cls: P2P_CLASS[l.status] || '', isOpen: l.status === 'open'
    }));
  renderRows('#adm-p2p', '#adm-p2p-empty', 'tpl-adm-p2p', items, {
    save: (d, ev) => adminP2pSave(d, ev),
    remove: (d) => adminP2pRemove(d)
  });
}

// تغيير منشور: السعر والملاحظة
async function adminP2pSave(d, ev) {
  const row = ev.target.closest('tr');
  const price = parseFloat($('[data-role="price"]', row).value);
  const note = $('[data-role="note"]', row).value.trim().slice(0, 100);
  if (!(price >= MIN_AMOUNT)) return toast('err_min', { min: fd(MIN_AMOUNT) });

  try {
    await db.ref('p2p/' + d.id).update({ price, note });
    await logAction(t('log_p2p_edit'), `${d.sym} — ${fd(price)}`);
    toast('ok_p2p_edited');
  } catch (err) {
    fail(err, 'f_save');
  }
}

// نزع منشور: تعود العملات المحجوزة إلى صاحبه
async function adminP2pRemove(d) {
  const l = P2P[d.id];
  if (!l || l.status !== 'open') return;
  if (!confirm(t('confirm_p2p_remove'))) return;

  try {
    const claim = await claimStatus(db.ref('p2p/' + d.id + '/status'), 'open', 'cancelled');
    if (!claim.committed) return toast('err_listing_gone');
    await updateUser(l.uid, (u) => {
      u.h = u.h || {};
      u.cost = u.cost || {};
      u.h[l.sym] = (u.h[l.sym] || 0) + l.qty;
      u.cost[l.sym] = (u.cost[l.sym] || 0) + (l.cost || 0);
      return u;
    });
    await logAction(t('log_p2p_remove'), `${l.sym} — ${l.name}`);
    toast('ok_p2p_removed');
  } catch (err) {
    fail(err, 'f_exec');
  }
}

// عند حذف حساب: نحذف منشوراته
async function removeUserListings(uid) {
  const all = (await db.ref('p2p').get()).val() || {};
  await Promise.all(Object.entries(all).filter(([, l]) => l.uid === uid).map(([id]) => db.ref('p2p/' + id).remove()));
}


/* ===== other.html: معاملات أخرى — فليكسي =====
   الطلب يُخصم مبلغه فوراً ويبقى معلّقاً إلى أن ينفّذه الأدمن، فإن رفضه عاد المبلغ إلى الرصيد. */
const FLEXY_MIN = 200;                                           // أقل مبلغ (DZD)
const FLEXY_PREFIX = { Ooredoo: '05', Mobilis: '06', Djezzy: '07' };   // بداية الرقم لكل مشغّل
const ORDER_CLASS = { pending: 'b-pending', done: 'b-ok', rejected: 'b-no' };

function otherInit() { loadMyOrders(); }

async function loadMyOrders() {
  const snap = await db.ref('orders/' + S.uid).get();
  const list = Object.values(snap.val() || {}).sort((a, b) => b.ts - a.ts);
  renderRows('#orders', '#orders-empty', 'tpl-order', list.map((o) => ({
    d: o.d, op: o.op, number: o.number, amount: fd(o.amount), label: t('ord_' + o.status), cls: ORDER_CLASS[o.status] || ''
  })), {});
}

async function doFlexy() {
  const u = S.user;
  const op = $('input[name="fx-op"]:checked').value;
  const number = $('#fx-number').value.trim().replace(/\s/g, '');
  const amount = parseFloat($('#fx-amount').value);

  if (!/^0[567]\d{8}$/.test(number) || !number.startsWith(FLEXY_PREFIX[op])) return toast('err_fx_number');
  if (!(amount >= FLEXY_MIN)) return toast('err_min', { min: fd(FLEXY_MIN) });
  if (amount > u.bal) return toast('err_funds');
  if (!confirm(t('confirm_flexy', { op, number, amount: fd(amount) }))) return;

  const key = db.ref('orders/' + S.uid).push().key;
  try {
    // خصم المبلغ وتسجيل الطلب في عملية واحدة
    await db.ref().update({
      ['users/' + S.uid + '/bal']: firebase.database.ServerValue.increment(-amount),
      [`orders/${S.uid}/${key}`]: { type: 'flexy', op, number, amount, status: 'pending', name: u.name, email: u.email, d: nowText(), ts: Date.now() }
    });
    u.bal -= amount;
    await addTx(t('tx_flexy'), '-' + f(amount), t('note_flexy', { op, number }));
    ['fx-number', 'fx-amount'].forEach((id) => { $('#' + id).value = ''; });
    bindUser();
    toast('ok_flexy_sent');
    loadMyOrders();
  } catch (err) {
    fail(err, 'f_exec');
  }
}

/* ===== admin_orders.html: الأدمن ينفّذ الطلبات أو يرفضها ===== */
let ORDERS = {};   // 'uid/oid' -> الطلب

function adminOrdersInit() { loadAdminOrders(); }

async function loadAdminOrders() {
  try {
    const snap = await db.ref('orders').get();
    ORDERS = {};
    Object.entries(snap.val() || {}).forEach(([uid, list]) => {
      Object.entries(list).forEach(([oid, o]) => { ORDERS[uid + '/' + oid] = { ...o, uid, oid }; });
    });

    const order = { pending: 0, done: 1, rejected: 2 };
    const items = Object.values(ORDERS)
      .sort((a, b) => (order[a.status] - order[b.status]) || (b.ts - a.ts))
      .map((o) => ({
        uid: o.uid, oid: o.oid, d: o.d, name: o.name, email: o.email, op: o.op, number: o.number, amount: fd(o.amount),
        label: t('ord_' + o.status), cls: ORDER_CLASS[o.status] || '', isPending: o.status === 'pending'
      }));
    renderRows('#adm-orders', '#adm-orders-empty', 'tpl-adm-order', items, {
      done: (d) => decideOrder(d.uid, d.oid, true),
      reject: (d) => decideOrder(d.uid, d.oid, false)
    });
  } catch (err) {
    fail(err, 'f_load');
  }
}

async function decideOrder(uid, oid, ok) {
  const o = ORDERS[uid + '/' + oid];
  if (!o) return;

  try {
    const claim = await claimStatus(db.ref(`orders/${uid}/${oid}/status`), 'pending', ok ? 'done' : 'rejected');
    if (!claim.committed) { toast('err_processed'); return loadAdminOrders(); }

    if (!ok) {   // الرفض: يعود المبلغ إلى صاحب الطلب
      await changeBalance(uid, o.amount);
      await db.ref('tx/' + uid).push({
        t: t('tx_flexy_refund'), amt: '+' + f(o.amount), note: t('note_flexy', { op: o.op, number: o.number }), d: nowText(), ts: Date.now()
      });
    }

    await logAction(t(ok ? 'log_flexy_done' : 'log_flexy_reject'), `${o.email} — ${o.op} ${o.number} — ${fd(o.amount)}`);
    toast(ok ? 'ok_order_done' : 'ok_order_rejected');
    loadAdminOrders();
  } catch (err) {
    fail(err, 'f_exec');
  }
}


/* ---------- 7) ربط الصفحات وتشغيل التطبيق ---------- */
const PAGES = {
  login: {},
  register: { init: changeMethod },
  home: { init: renderCoinList, live: coinListLive },
  favorites: { init: renderCoinList, live: coinListLive },
  bots: { init: botsInit },
  admin_bots: { init: adminBotsInit },
  p2p: { init: p2pInit },
  admin_p2p: { init: adminP2pInit },
  other: { init: otherInit },
  admin_orders: { init: adminOrdersInit },
  trade: { init: tradeDraw, live: tradeDraw },
  wallet: { init: walletInit, live: walletInit },
  history: { init: historyInit },
  add_money: {},
  directing_money: {},
  transfer: { init: transferInit },
  friends: { init: friendsInit },
  messages: { init: messagesInit },
  setting: { init: settingInit },
  admin: { init: adminInit },
  admin_trade: { init: adminTradeInit }
};

// تحديث الأسعار كل ثانيتين دون إعادة رسم الصفحة
setInterval(() => {
  refreshCoins();
  if (!S.user) return;
  bindUser();
  const page = PAGES[pageKey];
  if (started && page && page.live) page.live();
}, 2000);

startPage();
