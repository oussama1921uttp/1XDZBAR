/* ==========================================================
   صفحات: تسجيل الدخول وإنشاء حساب
   ========================================================== */

function loginPage() {
  return `<div class="card">
    <h2>تسجيل الدخول</h2>
    <label>البريد الإلكتروني</label>
    <input id="e" type="email">
    <label>كلمة المرور</label>
    <input id="p" type="password">
    <button onclick="doLogin()">دخول</button>
    <button class="l" onclick="location.hash='register'">إنشاء حساب</button>
  </div>`;
}

async function doLogin() {
  try {
    await auth.signInWithEmailAndPassword($('#e').value.trim(), $('#p').value);
    location.hash = 'home';
  } catch (err) {
    toast('بيانات الدخول غير صحيحة');
  }
}

function registerPage() {
  const wilayaOptions = WILAYAS
    .map((w, i) => `<option value="${w}">${i + 1} - ${w}</option>`)
    .join('');

  return `<div class="card">
    <h2>إنشاء حساب</h2>
    <p class="mu"></p>

    <h3>الحساب</h3>
    <div class="grid2">
      <div><label>اسم المستخدم</label><input id="un"></div>
      <div><label>البريد الإلكتروني</label><input id="e" type="email"></div>
      <div><label>رقم الهاتف</label><input id="ph" inputmode="tel" placeholder="0550123456"></div>
      <div></div>
      <div><label>كلمة المرور</label><input id="p" type="password"></div>
      <div><label>إعادة كلمة المرور</label><input id="p2" type="password"></div>
    </div>

    <h3>المعلومات الشخصية</h3>
    <div class="grid2">
      <div><label>الاسم</label><input id="n"></div>
      <div><label>اللقب</label><input id="l"></div>
      <div><label>تاريخ الميلاد</label><input id="bd" type="date"></div>
    </div>

    <h3>وسيلة الدفع</h3>
    <label>الوسيلة</label>
    <select id="m" onchange="changeMethod()">
      <option>card visa</option>
      <option>Baridi Mob</option>
    </select>
    <div id="mf">${paymentFields('card visa')}</div>

    <h3>العنوان</h3>
    <div class="grid2">
      <div>
        <label>ولاية السكن</label>
        <select id="w"><option value="">اختر</option>${wilayaOptions}</select>
      </div>
      <div><label>الرمز البريدي</label><input id="pc" inputmode="numeric" maxlength="5"></div>
    </div>
    <label>عنوان الإقامة</label>
    <input id="ad">

    <button onclick="doRegister()">تسجيل</button>
    <button class="l" onclick="location.hash='login'">لدي حساب</button>
  </div>`;
}

// يرجع أول خطأ في النموذج، أو '' إذا كان سليماً
function registerError(val, method) {
  if (val('un').length < 3) return 'اسم المستخدم 3 أحرف على الأقل';
  if (!/^\S+@\S+\.\S+$/.test(val('e'))) return 'بريد إلكتروني غير صالح';
  if (!/^0[567]\d{8}$/.test(val('ph'))) return 'رقم هاتف غير صالح (مثال 0550123456)';
  if ($('#p').value.length < 6) return 'كلمة المرور 6 أحرف على الأقل';
  if ($('#p').value !== $('#p2').value) return 'كلمتا المرور غير متطابقتين';
  if (!val('n') || !val('l')) return 'أدخل الاسم واللقب';
  if (!$('#bd').value) return 'أدخل تاريخ الميلاد';

  const paymentError = validatePayment(method);
  if (paymentError) return paymentError;

  if (!val('w')) return 'اختر الولاية';
  if (!/^\d{5}$/.test(val('pc'))) return 'الرمز البريدي 5 أرقام';
  if (!val('ad')) return 'أدخل عنوان الإقامة';
  return '';
}

async function doRegister() {
  const val = (id) => $('#' + id).value.trim();
  const method = $('#m').value;

  const error = registerError(val, method);
  if (error) return toast(error);

  // نحفظ آخر 4 أرقام فقط من وسيلة الدفع
  const masked = method === 'Baridi'
    ? 'RIP ****' + val('rip').slice(-4)
    : '**** ' + val('cn').replace(/\s/g, '').slice(-4);

  const profile = {
    user: val('un'),
    name: val('n') + ' ' + val('l'),
    email: val('e'),
    phone: val('ph'),
    birth: $('#bd').value,
    wil: val('w'),
    post: val('pc'),
    addr: val('ad'),
    pm: { t: method, h: val('fn') + ' ' + val('ln'), k: masked },
    bal: 0,
    created: Date.now()
  };

  S.registering = true;
  try {
    const cred = await auth.createUserWithEmailAndPassword(val('e'), $('#p').value);
    await db.ref('users/' + cred.user.uid).set(profile);
    await loadUser(cred.user.uid);

    S.registering = false;
    S.ready = true;
    location.hash = 'home';
    route();
  } catch (err) {
    S.registering = false;
    toast(err.code === 'auth/email-already-in-use'
      ? 'البريد مستخدم من قبل'
      : 'تعذر التسجيل: ' + (err.code || err.message));
  }
}
