const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profileAddress, validateSnapshot, fetchSnapshot } = require('../kyd-connector.js');
const snapshot = () => ({ source:'KYD', version:1, currency:'RUB', generatedAt:'2026-09-27T10:00:00.000Z', progressPct:35, totalDebtsCount:3, publicShowAmounts:true, totalCurrentBalance:65000, debtFreeDate:'2027-04-01' });

test('profile links are normalized, tracking and fragments are discarded', () => {
  assert.deepEqual(profileAddress('https://kyd.example/p/alex/?tracking=1#hello'), { profile:'https://kyd.example/p/alex', endpoint:'https://kyd.example/api/public/helper/alex' });
});
test('rejects insecure links, credentials, and non-profile paths', () => {
  for (const url of ['http://kyd.example/p/alex', 'https://user:secret@kyd.example/p/alex', 'javascript:alert(1)', 'https://kyd.example/app', 'https://kyd.example/p/a/b', 'https://kyd.example/p/%22onclick']) assert.throws(() => profileAddress(url));
  assert.equal(profileAddress('http://localhost:8000/p/test').profile, 'http://localhost:8000/p/test');
});
test('privacy overrides incoming balance; unrelated fields never enter storage', () => {
  const result = validateSnapshot({ ...snapshot(), publicShowAmounts:false, totalCurrentBalance:99999, token:'do not retain', id:'private-id', debts:[{ name:'private' }] });
  assert.equal(result.totalCurrentBalance, null);
  assert.equal(result.token, undefined); assert.equal(result.id, undefined); assert.equal(result.debts, undefined);
});
test('validates financial fields and protocol before updating a saved snapshot', () => {
  for (const patch of [{ progressPct:101 }, { progressPct:NaN }, { totalDebtsCount:2.5 }, { totalCurrentBalance:-1 }, { totalCurrentBalance:'1000' }, { currency:'USD' }, { generatedAt:'bad' }, { version:2 }, { debtFreeDate:'<img src=x>' }, { publicShowAmounts:undefined }]) assert.throws(() => validateSnapshot({ ...snapshot(), ...patch }));
  assert.equal(validateSnapshot({ ...snapshot(), totalCurrentBalance:0, progressPct:100 }).progressPct, 100);
});
test('network boundary omits credentials, redirects, caching, and referrers', async () => {
  const oldFetch = global.fetch;
  try {
    global.fetch = async (url, options) => { assert.equal(url, 'https://kyd.example/api/public/helper/alex'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.equal(options.referrerPolicy, 'no-referrer'); return new Response(JSON.stringify(snapshot())); };
    assert.equal((await fetchSnapshot('https://kyd.example/p/alex')).totalCurrentBalance,65000);
    for (const response of [new Response('missing',{status:404}),new Response('<html>login</html>'),new Response('x'.repeat(50001)),new Response('error',{status:500})]) { global.fetch = async () => response; await assert.rejects(fetchSnapshot('https://kyd.example/p/alex')); }
  } finally { global.fetch = oldFetch; }
});
