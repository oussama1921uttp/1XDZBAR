/* ==========================================================
   التطبيق: التوجيه + القائمة الجانبية + التحديث الدوري
   ========================================================== */

// أسماء المسارات (بعد #) والدوال التي ترسم صفحاتها
const PAGES = {
  login: loginPage,
  register: registerPage,
  home: homePage,
  trade: tradePage,
  wallet: walletPage,
  history: historyPage,
  add: addPage,
  withdraw: withdrawPage,
  settings: settingsPage,
  admin: adminPage,
  admin_trade: adminTradePage
};

const PUBLIC_PAGES = ['login', 'register'];
const ADMIN_PAGES = ['admin', 'admin_trade'];

// روابط القائمة الجانبية
const MENU = [
  ['home', '🏠 الرئيسية'],
  ['wallet', '👛 محفظتي'],
  ['history', '🧾 السجل'],
  ['add', '➕ إيداع'],
  ['withdraw', '➖ سحب'],
  ['settings', '⚙️ الإعدادات']
];
const ADMIN_MENU = [
  ['admin', '🛡️ الأدمن'],
  ['admin_trade', '📊 إدارة العملات']
];

function currentRoute() {
  const [page, param] = (location.hash.slice(1) || 'home').split('/');
  return { page, param };
}

function renderNav(page) {
  const u = S.user;
  if (!u) { $('#nav').innerHTML = ''; return; }

  const items = S.isAdmin ? MENU.concat(ADMIN_MENU) : MENU;

  const links = items.map(([key, label]) => {
    const active = key === page || (page === 'trade' && key === 'home');
    return `<a href="#${key}" class="${active ? 'on' : ''}">${label}</a>`;
  }).join('');

  $('#nav').innerHTML = `<nav>
    <div class="u"><b>${esc(u.name)}</b><span class="mu">$${f(total(u))}</span></div>
    ${links}
    <div class="sp"></div>
    <a href="#login" onclick="logout()">🚪 خروج</a>
  </nav>`;
}

function route() {
  if (!S.ready) return;

  const { page, param } = currentRoute();
  const loggedIn = !!S.user;

  // حماية الصفحات
  if (!loggedIn && !PUBLIC_PAGES.includes(page)) { location.hash = 'login'; return; }
  if (loggedIn && PUBLIC_PAGES.includes(page)) { location.hash = 'home'; return; }
  if (ADMIN_PAGES.includes(page) && !S.isAdmin) { location.hash = 'home'; return; }

  const render = PAGES[page] || homePage;
  $('#app').innerHTML = render(param);
  renderNav(page);
}

// تحديث الأسعار كل ثانيتين دون إعادة رسم الصفحة كاملة
function updateLivePrices() {
  refreshCoins();
  if (!S.user) return;

  const { page, param } = currentRoute();

  if (page === 'home' && $('#tot')) {
    COINS.forEach((c) => {
      const priceEl = $('#p-' + c.s);
      if (!priceEl) return;

      const change = (c.p / c.h[0] - 1) * 100;
      const changeEl = $('#c-' + c.s);

      priceEl.textContent = '$' + f(c.p);
      changeEl.className = change >= 0 ? 'up' : 'dn';
      changeEl.textContent = (change >= 0 ? '▲ ' : '▼ ') + f(Math.abs(change)) + '%';
    });
    $('#tot').textContent = '$' + f(total(S.user));
  }

  if (page === 'trade' && coin(param) && $('#tp')) {
    const c = coin(param);
    $('#tp').textContent = '$' + f(c.p);
    $('#ch').innerHTML = renderChart(c);
    $('#hold').innerHTML = positionStats(c, S.user);
  }
}

/* ---------- التشغيل ---------- */
addEventListener('hashchange', route);
setInterval(updateLivePrices, 2000);
startAuthListener();
