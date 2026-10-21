/* صفحة setting.html — الإعدادات */

function settingPage() {
  const u = S.user;

  return `<div class="card">
    <h2>الإعدادات</h2>
    <div class="grid2">
      <div><label>اسم المستخدم</label><input id="un" value="${esc(u.user)}"></div>
      <div><label>الاسم واللقب</label><input id="n" value="${esc(u.name)}"></div>
      <div><label>الهاتف</label><input id="ph" value="${esc(u.phone)}"></div>
      <div><label>الرمز البريدي</label><input id="pc" value="${esc(u.post)}"></div>
    </div>
    <label>عنوان الإقامة</label>
    <input id="ad" value="${esc(u.addr)}">
    <label>البريد: ${esc(u.email)} — ID: ${esc(u.pid || '')}</label>

    <label>كلمة مرور جديدة (اتركها فارغة للإبقاء)</label>
    <input id="p" type="password">

    <button onclick="saveSettings()">حفظ</button>
    <button class="l" onclick="toggleTheme()">تبديل الوضع الليلي</button>
  </div>`;
}

async function saveSettings() {
  const val = (id) => $('#' + id).value.trim();

  if (!val('n') || !val('un')) return toast('الاسم واسم المستخدم مطلوبان');

  Object.assign(S.user, {
    user: val('un'),
    name: val('n'),
    phone: val('ph'),
    post: val('pc'),
    addr: val('ad')
  });

  await db.ref('users/' + S.uid).update({
    user: S.user.user,
    name: S.user.name,
    phone: S.user.phone,
    post: S.user.post,
    addr: S.user.addr
  });

  if ($('#p').value) {
    try {
      await auth.currentUser.updatePassword($('#p').value);
    } catch (err) {
      return toast('لتغيير كلمة المرور سجّل الدخول من جديد ثم أعد المحاولة');
    }
  }

  db.ref('directory/' + S.uid).set({ name: S.user.name, user: S.user.user });
  logAction('تعديل الإعدادات', S.user.user);
  toast('تم الحفظ');
  renderPage();
}

startPage({ key: 'setting', access: 'user', render: settingPage });
