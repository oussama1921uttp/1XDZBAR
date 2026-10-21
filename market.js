/* ==========================================================
   سوق العملات (محاكاة)
   السعر يُحسب من الوقت، فيراه كل المستخدمين نفسه
   ========================================================== */

let COINS = [];   // قائمة العملات مع السعر الحالي وآخر 60 نقطة

// رقم الخطوة الحالية (خطوة كل ثانيتين)
function currentTick() {
  return Math.floor(Date.now() / 2000);
}

// سعر العملة عند خطوة معيّنة
//   cfg.p   : السعر الأساسي
//   cfg.vol : حجم التذبذب
//   cfg.dr  : الاتجاه (‰ لكل خطوة منذ cfg.k0)
function priceAt(symbol, cfg, k) {
  const phase = [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  const wave =
    Math.sin(k / 23 + phase) +
    0.6 * Math.sin(k / 7.1 + 2 * phase) +
    0.35 * Math.sin(k / 2.9 + 3 * phase);

  const stepsSince = Math.max(0, k - (cfg.k0 || 0));
  const drift = Math.max(-1, Math.min(1, ((cfg.dr || 0) / 1000) * stepsSince));

  return cfg.p * Math.exp(((cfg.vol || 0) / 100) * 3 * wave + drift);
}

// إعادة بناء COINS من الإعدادات الحالية
function refreshCoins() {
  const k = currentTick();
  const source = S.coinConfig;   // العملات تأتي كلها من قاعدة البيانات (يضيفها الأدمن)

  COINS = Object.entries(source).map(([symbol, cfg]) => {
    const history = [];
    for (let i = 59; i >= 0; i--) history.push(priceAt(symbol, cfg, k - i));

    return {
      s: symbol,
      n: cfg.n,
      basePrice: cfg.p,
      vol: cfg.vol || 0,
      dr: cfg.dr || 0,
      p: history[59],
      h: history
    };
  });
}

function coin(symbol) {
  return COINS.find((c) => c.s === symbol);
}

// القيمة الإجمالية = النقد + قيمة العملات
function total(user) {
  const holdings = Object.entries(user.h || {}).reduce((sum, [symbol, qty]) => {
    const c = coin(symbol);
    return sum + (c ? qty * c.p : 0);
  }, 0);
  return user.bal + holdings;
}

refreshCoins();
