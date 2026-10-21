/* ==========================================================
   إعدادات Firebase وتهيئته
   ========================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBGainTV-p9V4RSBWayXS4066_bAsUOFQ8",
  authDomain: "xdbar-ab33b.firebaseapp.com",
  databaseURL: "https://xdbar-ab33b-default-rtdb.firebaseio.com",
  projectId: "xdbar-ab33b",
  storageBucket: "xdbar-ab33b.firebasestorage.app",
  messagingSenderId: "809086945461",
  appId: "1:809086945461:web:78a6ee996f92f5c38b56fc"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// بريد الأدمن: أي حساب بهذا البريد يحصل على صلاحيات الإدارة الكاملة
// (القواعد في database.rules.json تتحقق من البريد نفسه على الخادم)
const ADMIN_EMAIL = 'gerchouche999@gmail.com';

// رصيد الأدمن الابتدائي بالدينار (يُمنح مرة واحدة)
const ADMIN_START_BALANCE = 85000000;

// ID ثابت لحساب الأدمن (بقية الحسابات تأخذ ID عشوائياً من 8 أرقام)
const ADMIN_ID = '00000001';
