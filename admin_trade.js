/* صفحة admin_trade.html — إدارة العملات (للأدمن فقط) */

function adminTradePage() {
  const coinRows = COINS.map((c) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-items:end;margin-bottom:10px">
    <div><b>${c.s}</b><div class="mu">${fd(c.p)}</div></div>
    <div><label>الاسم</label><input id="n-${c.s}" value="${esc(c.n)}"></div>
    <div><label>السعر الأساسي (DZD)</label><input id="b-${c.s}" type="number" step="any" value="${c.basePrice}"></div>
    <div><label>التقلب</label><input id="v-${c.s}" type="number" step="any" value="${c.vol}"></div>
    <div><label>الاتجاه</label><input id="d-${c.s}" type="number" step="any" value="${c.dr}"></div>
    <div><button class="l" onclick="deleteCoin('${c.s}')">🗑 حذف</button></div>
  </div>`).join('');

  return `<div class="card">
    <h2>إدارة العملات</h2>
    <p class="mu">التقلب: حجم التذبذب. الاتجاه: ميل الصعود/الهبوط (‰ لكل خطوة). تُطبَّق التعديلات على كل المستخدمين.</p>
    ${COINS.length
      ? coinRows + `<button onclick="saveCoins()">حفظ التعديلات</button>
    <button class="r" onclick="deleteAllCoins()">حذف كل العملات</button>`
      : '<p class="mu">لا توجد عملات حالياً. أضف أول عملة من البطاقة التالية.</p>'}
  </div>

  <div class="card">
    <h3>إضافة عملة</h3>
    <div class="row">
      <div><label>الرمز</label><input id="ns"></div>
      <div><label>الاسم</label><input id="nn"></div>
    </div>
    <div class="row">
      <div><label>السعر (DZD)</label><input id="np" type="number" step="any"></div>
      <div><label>التقلب</label><input id="nv" type="number" step="any" value="1"></div>
    </div>
    <button class="g" onclick="addCoin()">إضافة</button>
  </div>`;
}

async function saveCoins() {
  const data = {};
  const k = currentTick();

  COINS.forEach((c) => {
    data[c.s] = {
      n: $('#n-' + c.s).value.trim() || c.n,
      p: parseFloat($('#b-' + c.s).value) || c.basePrice,
      vol: parseFloat($('#v-' + c.s).value) || 0,
      dr: parseFloat($('#d-' + c.s).value) || 0,
      k0: k
    };
  });

  try {
    await db.ref('coins').set(data);
    logAction('تعديل العملات', Object.keys(data).join(', '));
    toast('تم الحفظ');
    renderPage();
  } catch (err) {
    fail(err, 'تعذر التنفيذ');
  }
}

async function addCoin() {
  const symbol = $('#ns').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const price = parseFloat($('#np').value);

  if (!symbol || !(price > 0) || coin(symbol)) return toast('رمز أو سعر غير صالح');

  try {
    await db.ref('coins/' + symbol).set({
      n: $('#nn').value.trim() || symbol,
      p: price,
      vol: parseFloat($('#nv').value) || 1,
      dr: 0,
      k0: currentTick()
    });
    logAction('إضافة عملة', symbol);
    setTimeout(renderPage, 400);
  } catch (err) {
    fail(err, 'تعذر التنفيذ');
  }
}

/* ---------- حذف عملة أو كل العملات ---------- */
async function deleteCoin(symbol) {
  if (!confirm(`حذف العملة ${symbol}؟ ستختفي من الموقع، وما يملكه المستخدمون منها لن يُحتسب في أرصدتهم.`)) return;

  try {
    await db.ref('coins/' + symbol).remove();
    logAction('حذف عملة', symbol);
    toast('تم حذف العملة');
    setTimeout(renderPage, 400);
  } catch (err) {
    fail(err, 'تعذر الحذف');
  }
}

async function deleteAllCoins() {
  if (!confirm('حذف كل العملات؟ ستبدأ من الصفر، وما يملكه المستخدمون منها لن يُحتسب في أرصدتهم.')) return;

  try {
    await db.ref('coins').remove();
    logAction('حذف كل العملات', '');
    toast('تم حذف كل العملات');
    setTimeout(renderPage, 400);
  } catch (err) {
    fail(err, 'تعذر الحذف');
  }
}

startPage({ key: 'admin_trade', access: 'admin', render: adminTradePage });
