/* ==========================================================
   أدوات مساعدة عامة
   ========================================================== */

// الحد الأدنى لأي عملية شراء أو بيع (بالدينار الافتراضي)
const MIN_TRADE = 100;

// الحد الأدنى لأي تحويل بين الحسابات (DZD)
const MIN_TRANSFER = 100;

// الولايات الجزائرية الـ58
const WILAYAS = [
  'أدرار', 'الشلف', 'الأغواط', 'أم البواقي', 'باتنة', 'بجاية', 'بسكرة', 'بشار',
  'البليدة', 'البويرة', 'تمنراست', 'تبسة', 'تلمسان', 'تيارت', 'تيزي وزو', 'الجزائر',
  'الجلفة', 'جيجل', 'سطيف', 'سعيدة', 'سكيكدة', 'سيدي بلعباس', 'عنابة', 'قالمة',
  'قسنطينة', 'المدية', 'مستغانم', 'المسيلة', 'معسكر', 'ورقلة', 'وهران', 'البيض',
  'إليزي', 'برج بوعريريج', 'بومرداس', 'الطارف', 'تندوف', 'تيسمسيلت', 'الوادي', 'خنشلة',
  'سوق أهراس', 'تيبازة', 'ميلة', 'عين الدفلى', 'النعامة', 'عين تموشنت', 'غرداية', 'غليزان',
  'تيميمون', 'برج باجي مختار', 'أولاد جلال', 'بني عباس', 'إن صالح', 'إن قزام', 'تقرت', 'جانت',
  'المغير', 'المنيعة'
];

// اختصار لـ querySelector
function $(selector) {
  return document.querySelector(selector);
}

// حماية النصوص قبل وضعها داخل HTML
function esc(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

// مبلغ بالدينار: 1234.5 -> 1,234.5 DZD
function fd(n) {
  return f(n) + ' DZD';
}

// تنسيق الأرقام: 1234.5 -> 1,234.5
function f(n) {
  return Number(n).toLocaleString('en', { maximumFractionDigits: 2 });
}

// رسالة قصيرة تظهر أسفل الشاشة
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2600);
}

// تبديل الوضع الليلي
function toggleTheme() {
  const root = document.documentElement;
  const isDark =
    root.dataset.theme === 'dark' ||
    (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = isDark ? 'light' : 'dark';
}

// حالات طلبات الإيداع والسحب: [النص, صنف الشارة]
const REQUEST_STATUS = {
  pending:  ['قيد المراجعة', 'b-pending'],
  approved: ['تمت الموافقة', 'b-ok'],
  rejected: ['مرفوض', 'b-no']
};

/* ---------- أخطاء الصلاحيات ---------- */

function isPermissionError(err) {
  return /permission_denied|permission denied/i.test(((err && err.code) || '') + ((err && err.message) || ''));
}

// بطاقة تشرح سبب رفض الصلاحية وكيف يُصلح
function permissionHelp() {
  const u = auth.currentUser || {};
  return `<div class="card" id="perm-help" style="border-color:var(--dn)">
    <h3 class="dn">قاعدة البيانات رفضت الصلاحية</h3>
    <p class="mu">الحساب الحالي: <b>${esc(u.email)}</b><br>UID: <b style="user-select:all">${esc(u.uid)}</b></p>
    <ol class="mu">
      <li>افتح Firebase Console ← Realtime Database ← Rules، واحذف كل المحتوى والصق محتوى ملف <b>database.rules.json</b> كاملاً، ثم اضغط <b>Publish</b>.</li>
      <li>تأكد أنك دخلت بالبريد <b>${esc(ADMIN_EMAIL)}</b>.</li>
      <li>إن استمر الخطأ: في Realtime Database أضف عقدة <b>admins</b> وتحتها مفتاحاً باسم UID أعلاه وقيمته <b>true</b>، ثم أعد تسجيل الدخول.</li>
    </ol>
  </div>`;
}

function showPermissionHelp() {
  if (!$('#perm-help') && $('#app')) $('#app').insertAdjacentHTML('afterbegin', permissionHelp());
}

// معالجة موحّدة لأخطاء قاعدة البيانات
function fail(err, prefix) {
  if (isPermissionError(err)) {
    showPermissionHelp();
    return toast('لا توجد صلاحية — راجع التعليمات أعلى الصفحة');
  }
  toast((prefix ? prefix + ': ' : '') + ((err && (err.code || err.message)) || ''));
}
