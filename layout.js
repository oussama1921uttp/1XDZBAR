/* ==========================================================
   هيكل مشترك لكل الصفحات:
   - حماية الصفحة (دخول / أدمن)
   - رسم الصفحة والقائمة الجانبية
   - تحديث الأسعار الحية
   ========================================================== */

// روابط القائمة الجانبية: [مفتاح الصفحة, الملف, النص]
const MENU = [
  ['home',            'index.html',            '🏠 الرئيسية'],
  ['wallet',          'wallet.html',           '👛 محفظتي'],
  ['transfer',        'transfer.html',         '💸 تحويل'],
  ['history',         'history.html',          '🧾 السجل'],
  ['add_money',       'add_money.html',        '➕ إيداع'],
  ['directing_money', 'directing_money.html',  '➖ سحب'],
  ['friends',         'friends.html',          '👥 طلبات الصداقة'],
  ['messages',        'messages.html',         '💬 الرسائل'],
  ['setting',         'setting.html',          '⚙️ الإعدادات']
];

const ADMIN_MENU = [
  ['admin',       'admin.html',        '🛡️ الأدمن'],
  ['admin_trade', 'admin_trade.html',  '📊 إدارة العملات']
];

// شعار الموقع
const LOGO = '<span class="logo"><span class="logo-x">1X</span><span class="logo-t">DZBAR</span></span>';

let PAGE = null;   // { key, access, render, live }

/*
  كل صفحة تستدعي startPage مرة واحدة:
    key    : اسم الصفحة (لتمييزها في القائمة)
    access : 'public' | 'user' | 'admin'
    render : دالة ترجع HTML الصفحة
    live   : (اختياري) دالة تُستدعى كل ثانيتين لتحديث الأسعار
*/
function startPage(options) {
  PAGE = options;
  startAuthListener(onAuthReady);
}

function onAuthReady() {
  const loggedIn = !!S.user;

  if (PAGE.access === 'public') {
    if (loggedIn) return location.replace('index.html');
  } else {
    if (!loggedIn) return location.replace('login.html');
    if (PAGE.access === 'admin' && !S.isAdmin) return location.replace('index.html');
  }

  watchFriendRequests();
  renderPage();
}

// عدّاد طلبات الصداقة الواردة في القائمة الجانبية
function watchFriendRequests() {
  if (S.watchReq) return;
  S.watchReq = true;
  S.reqCount = 0;
  db.ref('friendReq/' + S.uid).on('value', (snap) => {
    S.reqCount = snap.numChildren();
    renderNav();
  }, () => {});
}

function renderPage() {
  const flash = sessionStorage.getItem('flash');
  if (flash) { sessionStorage.removeItem('flash'); setTimeout(() => toast(flash), 200); }

  const isPublic = PAGE.access === 'public';
  const hero = isPublic
    ? `<div class="auth-hero">${LOGO}<p>منصة محاكاة التداول</p></div>`
    : '';

  $('#app').className = isPublic ? 'narrow' : '';
  $('#app').innerHTML = hero + PAGE.render();
  renderNav();

  // الأدمن بلا صلاحية فعلية على قاعدة البيانات: نشرح السبب
  if (S.isAdmin && S.permissionProblem) setTimeout(showPermissionHelp, 300);
}

function renderNav() {
  if (!S.user) { $('#nav').innerHTML = ''; return; }

  const items = S.isAdmin ? MENU.concat(ADMIN_MENU) : MENU;

  const links = items.map(([key, href, label]) => {
    const active = key === PAGE.key || (PAGE.key === 'trade' && key === 'home');
    const badge = (key === 'friends' && S.reqCount) ? ` <span class="badge b-no">${S.reqCount}</span>` : '';
    return `<a href="${href}" class="${active ? 'on' : ''}">${label}${badge}</a>`;
  }).join('');

  $('#nav').innerHTML = `<nav>
    <div class="brand">${LOGO}</div>
    <div class="u"><b>${esc(S.user.name)}</b><span class="mu">${fd(total(S.user))}</span><span class="mu">ID: ${esc(S.user.pid || '')}</span></div>
    ${links}
    <div class="sp"></div>
    <a href="#" onclick="logout(); return false;">🚪 خروج</a>
  </nav>`;
}

// تحديث الأسعار كل ثانيتين دون إعادة رسم الصفحة
setInterval(() => {
  refreshCoins();
  if (S.user && PAGE && PAGE.live) PAGE.live();
}, 2000);
