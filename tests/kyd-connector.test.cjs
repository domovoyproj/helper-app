const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profileAddress, parseProfile, validateSnapshot, fetchSnapshot } = require('../kyd-connector.js');
const snapshot = () => ({ source:'KYD', version:1, currency:'RUB', generatedAt:'2026-09-27T10:00:00.000Z', progressPct:35, totalDebtsCount:3, publicShowAmounts:true, totalCurrentBalance:65000, debtFreeDate:'2027-04-01' });

test('profile links are normalized, tracking and fragments are discarded', () => {
  assert.deepEqual(profileAddress('https://kyd.example/p/alex/?tracking=1#hello'), { profile:'https://kyd.example/p/alex', endpoint:'https://kyd.example/p/alex' });
});
test('rejects insecure links, credentials, and non-profile paths', () => {
  for (const url of ['', 'not a URL', 'http://kyd.example/p/alex', 'https://user:secret@kyd.example/p/alex', 'javascript:alert(1)', 'https://kyd.example/app', 'https://kyd.example/p/a/b', 'https://kyd.example/p/%22onclick']) assert.throws(() => profileAddress(url));
  assert.equal(profileAddress('http://localhost:8000/p/test').profile, 'http://localhost:8000/p/test');
});
test('privacy overrides incoming balance; unrelated fields never enter storage', () => {
  const result = validateSnapshot({ ...snapshot(), publicShowAmounts:false, totalCurrentBalance:99999, token:'do not retain', id:'private-id', debts:[{ name:'private' }] });
  assert.equal(result.totalCurrentBalance, null);
  assert.equal(result.token, undefined); assert.equal(result.id, undefined); assert.equal(result.debts, undefined);
});
test('validates financial fields and protocol before updating a saved snapshot', () => {
  for (const patch of [{ progressPct:101 }, { progressPct:NaN }, { totalDebtsCount:2.5 }, { totalCurrentBalance:-1 }, { totalCurrentBalance:'1000' }, { currency:'USD' }, { generatedAt:'bad' }, { version:2 }, { debtFreeDate:'<img src=x>' }, { debtFreeDate:'2026-02-31' }, { publicShowAmounts:undefined }]) assert.throws(() => validateSnapshot({ ...snapshot(), ...patch }));
  assert.equal(validateSnapshot({ ...snapshot(), totalCurrentBalance:0, progressPct:100 }).progressPct, 100);
});

test('official KYD profile falls back to the read-only reader after a browser CORS failure', async () => {
  const oldFetch = global.fetch;
  const markdown = `
Title: KYD — Убей свой долг

Markdown Content:
Прогресс ликвидации долгов

15

%

Дата свободы

нояб. 2026 г.

Текущий остаток

83 500₽

## Долги участника (6)`;
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) throw new TypeError('Failed to fetch');
      return new Response(markdown);
    };
    const result = await fetchSnapshot('https://domovoy1337.ru/p/domovoy');
    assert.equal(calls[0].url, 'https://domovoy1337.ru/p/domovoy');
    assert.equal(calls[1].url, 'https://r.jina.ai/https://domovoy1337.ru/p/domovoy');
    assert.equal(calls[1].options.credentials, 'omit');
    assert.equal(result.progressPct, 15);
    assert.equal(result.totalCurrentBalance, 83500);
    assert.equal(result.totalDebtsCount, 6);
    assert.equal(result.debtFreeDate, '2026-11-01');
  } finally { global.fetch = oldFetch; }
});

test('CORS fallback is restricted to the official KYD host', async () => {
  const oldFetch = global.fetch;
  let calls = 0;
  try {
    global.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); };
    await assert.rejects(fetchSnapshot('https://kyd.example/p/alex'), TypeError);
    assert.equal(calls, 1);
  } finally { global.fetch = oldFetch; }
});
test('network boundary omits credentials, follows redirects, and discards referrers', async () => {
  const oldFetch = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://kyd.example/p/alex');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'follow');
      assert.equal(options.referrerPolicy, 'no-referrer');
      return new Response(JSON.stringify(snapshot()));
    };
    assert.equal((await fetchSnapshot('https://kyd.example/p/alex')).totalCurrentBalance, 65000);
    for (const response of [new Response('missing', { status: 404 }), new Response('<html>login</html>'), new Response('x'.repeat(500001)), new Response('error', { status: 500 })]) {
      global.fetch = async () => response;
      await assert.rejects(fetchSnapshot('https://kyd.example/p/alex'));
    }
  } finally { global.fetch = oldFetch; }
});

test('parseProfile parses HTML profiles with progress, Russian date, balance, and debt count', () => {
  const sampleHtml = `
    <div class="text-xs uppercase font-bold tracking-widest text-muted">Прогресс ликвидации долгов</div>
    <div class="num mt-1 text-5xl font-black">15<!-- -->%</div>
    <div class="text-xs uppercase tracking-widest text-muted">Дата свободы</div>
    <div class="num mt-1 text-2xl font-bold">нояб. 2026 г.</div>
    <div class="text-xs text-muted">Текущий остаток</div>
    <div class="num text-xl font-bold">83 500 ₽</div>
    <h2>Долги участника (<!-- -->6<!-- -->)</h2>
    <article>debt 1</article><article>debt 2</article>
  `;
  const parsed = parseProfile(sampleHtml);
  assert.equal(parsed.source, 'KYD');
  assert.equal(parsed.progressPct, 15);
  assert.equal(parsed.debtFreeDate, '2026-11-01');
  assert.equal(parsed.publicShowAmounts, true);
  assert.equal(parsed.totalCurrentBalance, 83500);
  assert.equal(parsed.totalDebtsCount, 6);
});

test('parseProfile correctly handles hidden amounts and absent forecast dates', () => {
  const hiddenHtml = `
    <div>Прогресс ликвидации долгов</div><div class="num">50%</div>
    <div>Дата свободы</div><div class="num">Пока нет прогноза</div>
    <div>Текущий остаток</div><div class="num">Сумма скрыта</div>
    <h2>Долги участника (2)</h2>
  `;
  const parsed = parseProfile(hiddenHtml);
  assert.equal(parsed.progressPct, 50);
  assert.equal(parsed.debtFreeDate, null);
  assert.equal(parsed.publicShowAmounts, false);
  assert.equal(parsed.totalCurrentBalance, null);
  assert.equal(parsed.totalDebtsCount, 2);
});

test('parseProfile accepts JSON strings and objects directly', () => {
  const snap = snapshot();
  assert.deepEqual(parseProfile(JSON.stringify(snap)), snap);
  assert.deepEqual(parseProfile(snap), snap);
});

test('parseProfile rejects invalid or 404 responses', () => {
  assert.throws(() => parseProfile(''), /Пустой ответ/);
  assert.throws(() => parseProfile('<html><title>404: Not Found</title></html>'), /Профиль закрыт или не найден/);
  assert.throws(() => parseProfile('<html><body>Hello world</body></html>'), /Не удалось найти данные профиля/);
});

test('parseProfile parses Next.js RSC format with flight stream chunks', () => {
  const rscChunk = `
    1:[["$","div",null,{"className":"text-xs uppercase font-bold tracking-widest text-muted","children":"Прогресс ликвидации долгов"}],["$","div",null,{"className":"num mt-1 text-5xl font-black","children":[15,"%"]}]]
    2:[["$","div",null,{"className":"text-xs uppercase tracking-widest text-muted","children":"Дата свободы"}],["$","div",null,{"className":"num mt-1 text-2xl font-bold","children":"нояб. 2026 г."}]]
    3:[["$","div",null,{"children":[["$","div",null,{"className":"text-xs text-muted","children":"Текущий остаток"}],["$","div",null,{"className":"num text-xl font-bold","children":"83 500 ₽"}]]}]]
    4:Долги участника (",6,")
  `;
  const parsed = parseProfile(rscChunk);
  const validated = validateSnapshot(parsed);
  assert.equal(validated.progressPct, 15);
  assert.equal(validated.totalDebtsCount, 6);
  assert.equal(validated.publicShowAmounts, true);
  assert.equal(validated.totalCurrentBalance, 83500);
  assert.equal(validated.debtFreeDate, '2026-11-01');
});

test('parseProfile accepts an exact ISO forecast date from HTML', () => {
  const parsed = parseProfile(`
    <div>Прогресс ликвидации долгов</div><div class="num">75%</div>
    <div>Дата свободы</div><div class="num">2027-04-15</div>
    <div>Текущий остаток</div><div class="num">Сумма скрыта</div>
    <h2>Долги участника (1)</h2>
  `);
  assert.equal(parsed.debtFreeDate, '2027-04-15');
});
