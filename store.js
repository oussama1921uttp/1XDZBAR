/* ==========================================================
   الحالة العامة + التعامل مع قاعدة البيانات
   ========================================================== */

const S = {
  user: null,                // بيانات المستخدم الحالي
  uid: null,                 // معرّف المستخدم في Firebase
  isAdmin: false,            // هل هو أدمن؟ (من العقدة admins)
  tx: [],                    // معاملات المستخدم
  coinConfig: {},            // إعدادات العملات القادمة من القاعدة
  registering: false,        // جارٍ إنشاء حساب؟ (نوقف المستمع مؤقتاً)
  configListening: false,    // هل بدأنا الاستماع لإعدادات العملات؟
  balListening: false,       // هل بدأنا الاستماع للرصيد؟
  permissionProblem: false,  // فشلت كتابة تحتاج صلاحية الأدمن؟
  transferListening: false   // هل بدأنا الاستماع للتحويلات الواردة؟
};

// حفظ الرصيد والأصول
function saveUser() {
  return db.ref('users/' + S.uid).update({
    bal: S.user.bal,
    h: S.user.h,
    cost: S.user.cost
  });
}

// سجل عام لكل الأنشطة (يقرؤه الأدمن فقط)
function logAction(action, details) {
  const u = auth.currentUser;
  if (!u) return Promise.resolve();
  return db.ref('logs').push({
    uid: u.uid,
    actor: u.email,
    action: action,
    details: details || '',
    d: new Date().toLocaleString('ar-DZ'),
    ts: Date.now()
  });
}

// تسجيل معاملة جديدة (ترجع Promise ليمكن انتظارها)
function addTx(type, amount, note) {
  const entry = {
    t: type,
    amt: amount,
    note: note,
    d: new Date().toLocaleString('ar-DZ'),
    ts: Date.now()
  };
  S.tx.unshift(entry);
  return Promise.all([
    db.ref('tx/' + S.uid).push(entry),
    logAction(type, amount + ' — ' + note)
  ]);
}

// تحميل بيانات المستخدم وإعدادات العملات من Firebase
async function loadUser(uid, email) {
  S.uid = uid;
  S.isAdmin = (email || '').toLowerCase() === ADMIN_EMAIL;

  const [profile, tx, coins, adminNode] = await Promise.all([
    db.ref('users/' + uid).get(),
    db.ref('tx/' + uid).get(),
    db.ref('coins').get(),
    db.ref('admins/' + uid).get().catch(() => ({ val: () => null }))
  ]);

  // الأدمن: بالبريد، أو بوجود uid الخاص به في العقدة admins
  if (adminNode.val() === true) S.isAdmin = true;

  S.user = profile.val();

  // أول دخول للأدمن: ننشئ له ملفاً شخصياً تلقائياً
  if (!S.user && S.isAdmin) {
    S.user = { user: 'admin', name: 'المدير', email: email, phone: '', bal: ADMIN_START_BALANCE, seeded: true, created: Date.now() };
    await db.ref('users/' + uid).set(S.user);
  }

  // حساب أدمن قديم: نمنحه الرصيد الابتدائي مرة واحدة
  if (S.user && S.isAdmin && !S.user.seeded) {
    S.user.bal = ADMIN_START_BALANCE;
    S.user.seeded = true;
    await db.ref('users/' + uid).update({ bal: S.user.bal, seeded: true });
  }

  S.tx = Object.values(tx.val() || {}).sort((a, b) => b.ts - a.ts);
  S.coinConfig = coins.val() || {};
  refreshCoins();

  // Firebase يحذف الكائنات الفارغة، فنعيدها
  if (S.user) {
    S.user.h = S.user.h || {};
    S.user.cost = S.user.cost || {};

    // ID خاص بكل حساب (الأدمن له ID ثابت)
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

    // دليل الأسماء (للرسائل) + معرّف الأدمن (لتثبيته في الرسائل)
    db.ref('directory/' + uid)
      .set({ name: S.isAdmin ? 'الرئيس' : S.user.name, user: S.user.user || '', pid: S.user.pid || '' })
      .catch(() => {});
    if (S.isAdmin) {
      db.ref('meta/adminUid').set(uid).catch(() => { S.permissionProblem = true; });
    }
  }

  // متابعة تغييرات العملات التي يجريها الأدمن (مرة واحدة)
  if (!S.configListening) {
    S.configListening = true;
    db.ref('coins').on('value', (snap) => {
      S.coinConfig = snap.val() || {};
      refreshCoins();
    });
  }

  // مزامنة الرصيد عندما يوافق الأدمن على إيداع أو سحب
  if (!S.balListening) {
    S.balListening = true;
    db.ref('users/' + uid + '/bal').on('value', (snap) => {
      if (S.user && snap.val() !== null) S.user.bal = snap.val();
    });
  }

  // التحويلات الواردة: تُضاف إلى رصيدك فور وصولها
  if (S.user && !S.transferListening) {
    S.transferListening = true;
    db.ref('transfers/' + uid).on('child_added',
      (snap) => receiveTransfer(snap.key, snap.val()),
      () => {});
  }
}

// مراقبة حالة تسجيل الدخول؛ onChange تُستدعى بعد اكتمال التحميل
function startAuthListener(onChange) {
  auth.onAuthStateChanged(async (firebaseUser) => {
    if (S.registering) return;

    if (!firebaseUser) {
      S.user = null;
      S.uid = null;
      S.isAdmin = false;
      S.tx = [];
    } else {
      try {
        await loadUser(firebaseUser.uid, firebaseUser.email);
      } catch (err) {
        $('#app').innerHTML = `<div class="card"><h3 class="dn">تعذر تحميل بياناتك</h3>
          <p class="mu">${esc(err.message)}</p></div>` + permissionHelp();
        return;
      }
      if (!S.user) {            // حساب بلا ملف شخصي
        await auth.signOut();
        return;
      }
    }

    onChange();
  });
}

// الخروج: ننهي الجلسة ثم نعود دائماً إلى login.html
async function logout() {
  try { await logAction('تسجيل خروج', ''); } catch (e) {}
  try { await auth.signOut(); } catch (e) {}
  location.href = 'login.html';
}

/* ---------- ID الحسابات والتحويلات ---------- */

// توليد ID فريد من 8 أرقام وحجزه في العقدة ids (fixed: ID ثابت مطلوب)
async function claimId(uid, fixed) {
  for (let i = 0; i < 20; i++) {
    const pid = fixed || String(Math.floor(10000000 + Math.random() * 90000000));
    const result = await db.ref('ids/' + pid).transaction((cur) =>
      (cur === null || cur === uid) ? uid : undefined);
    if (result.committed) return pid;
    if (fixed) break;
  }
  throw new Error('تعذر حجز ID');
}

// استلام تحويل وارد: نحجزه أولاً (حتى لا يُضاف مرتين) ثم نضيف المبلغ
async function receiveTransfer(tid, t) {
  if (!t || t.status !== 'pending') return;

  const claim = await claimStatus(db.ref(`transfers/${S.uid}/${tid}/status`), 'pending', 'received');
  if (!claim.committed) return;

  await changeBalance(S.uid, t.amount);
  await addTx('تحويل مستلم', '+' + f(t.amount), `من ${t.fromName} (ID ${t.fromPid})`);

  if (typeof PAGE !== 'undefined' && PAGE) renderNav();
  toast(`وصلك تحويل ${fd(t.amount)} من ${t.fromName}`);
}

/* ---------- عمليات ذرّية آمنة ---------- */

// تغيير رصيد حساب بمقدار delta (يرفض الرصيد السالب)
// نقرأ القيمة أولاً لأن transaction تبدأ أحياناً بقيمة null
async function changeBalance(uid, delta) {
  const ref = db.ref('users/' + uid + '/bal');
  const known = (await ref.get()).val() || 0;

  return ref.transaction((bal) => {
    const current = bal === null ? known : bal;
    const next = current + delta;
    return next < 0 ? undefined : next;
  });
}

// تغيير حالة من from إلى to مرة واحدة فقط (يمنع المعالجة المزدوجة)
async function claimStatus(ref, from, to) {
  const known = (await ref.get()).val();

  return ref.transaction((s) => {
    const current = s === null ? known : s;
    return current === from ? to : undefined;
  });
}
