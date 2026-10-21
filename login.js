/* صفحة login.html — تسجيل الدخول */

function loginPage() {
  return `<div class="card">
    <h2>تسجيل الدخول</h2>
    <label>البريد الإلكتروني</label>
    <input id="e" type="email">
    <label>كلمة المرور</label>
    <input id="p" type="password">
    <button onclick="doLogin()">دخول</button>
    <button class="l" onclick="location.href='register.html'">إنشاء حساب</button>
  </div>`;
}

async function doLogin() {
  try {
    await auth.signInWithEmailAndPassword($('#e').value.trim(), $('#p').value);
    logAction('تسجيل دخول', $('#e').value.trim());
    // المستمع في layout.js سينقلك إلى index.html
  } catch (err) {
    toast('بيانات الدخول غير صحيحة');
  }
}

startPage({ key: 'login', access: 'public', render: loginPage });
