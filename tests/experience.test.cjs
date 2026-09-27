const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const connector = require('../kyd-connector.js');

function harness(fetchSnapshot) {
  const elements = new Map();
  const node = id => { if (!elements.has(id)) elements.set(id,{ value:'https://kyd.example/p/test', textContent:'', innerHTML:'', disabled:false }); return elements.get(id); };
  const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout, URL, Intl, Date,
    masterKey:'test-key', data:{ debts:[{ who:'Local', amount:-120 }] },
    document:{ getElementById:node },
    KYDConnector:{ ...connector, fetchSnapshot },
    saveEncrypted:() => {}, showToast:() => {}, escapeHtml:value => value
  });
  // Mounting the HTML is covered in browser checks; test the async state boundary here.
  const source = readFileSync(require.resolve('../experience.js'),'utf8').replace(/setupExperience\(\);\s*$/, '');
  vm.runInContext(source,context);
  return { context, node, run:code => vm.runInContext(code,context) };
}
const snapshot = { source:'KYD',version:1,currency:'RUB',generatedAt:'2026-09-27T00:00:00Z',progressPct:35,totalDebtsCount:2,publicShowAmounts:true,totalCurrentBalance:100,debtFreeDate:null };

test('KYD updates only its own snapshot, never Helper debts', async () => {
  const h = harness(async () => snapshot);
  await h.run('connectKYD()');
  assert.equal(h.context.data.debts[0].amount,-120);
  assert.equal(h.context.data.kyd.snapshot.progressPct,35);
});
test('late response cannot restore a disconnected integration', async () => {
  let finish; const h = harness(() => new Promise(resolve => { finish=resolve; }));
  const pending = h.run('connectKYD()'); h.run('disconnectKYD()'); finish(snapshot); await pending;
  assert.equal(h.context.data.kyd,undefined);
});
test('late response cannot write into a locked or replaced vault', async () => {
  let finish; const h = harness(() => new Promise(resolve => { finish=resolve; }));
  const pending = h.run('connectKYD()'); h.context.masterKey=''; h.context.data={}; finish(snapshot); await pending;
  assert.equal(h.context.data.kyd,undefined);
});
test('failed refresh removes a previously visible balance', async () => {
  const h = harness(async () => { throw new Error('Profile is private'); });
  h.context.data.kyd = { profileUrl:'https://kyd.example/p/test',snapshot };
  await h.run('connectKYD()');
  assert.equal(h.context.data.kyd.snapshot,null);
  assert.match(h.node('kyd-status').textContent,/Profile is private/);
});
