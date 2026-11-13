const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CryptoJS = require('../vendor/crypto-js.min.js');

function harness() {
  const storage = new Map();
  const context = vm.createContext({
    console, Date, Intl, CryptoJS, setTimeout, clearTimeout, setInterval:()=>0,
    window:{addEventListener(){}}, navigator:{}, document:{getElementById:()=>({value:''})},
    localStorage:{getItem:key=>storage.get(key) || null,setItem:(key,value)=>storage.set(key,value)},
  });
  vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../workspace.js'),'utf8'),context);
  vm.runInContext("masterKey='fixture-key';updateUI=()=>{};showSection=()=>{};showToast=()=>{}",context);
  return {run:code=>vm.runInContext(code,context),storage,context};
}

test('summary uses only the selected month and keeps original task indices',()=>{
  const h=harness();
  const s=h.run(`getWorkspaceSummary({tasks:[{text:'done',done:true},{text:'next',done:false}],budget:{transactions:[{date:'2026-11-01',type:'income',amount:1000},{date:'2026-11-04',type:'expense',amount:250},{date:'2026-10-10',type:'expense',amount:800}]}},'2026-11-13')`);
  assert.equal(s.balance,750);assert.equal(s.income,1000);assert.equal(s.expense,250);assert.equal(s.activeTasks[0].index,1);
});
test('task filtering preserves mutation indices and supports Russian search',()=>{
  const h=harness();
  const result=h.run(`selectWorkspaceTasks([{text:'Купить молоко',done:false},{text:'Купить хлеб',done:true},{text:'Работа',done:false}], 'done', 'ХЛЕБ')`);
  assert.equal(result.length,1);assert.equal(result[0].index,1);
});
test('one task creation path trims input, rejects empty text and persists encrypted data',()=>{
  const h=harness();assert.equal(h.run("createTask('  Купить хлеб  ')"),true);assert.equal(h.run("createTask('   ')"),false);
  assert.equal(h.run('data.tasks.length'),1);assert.equal(h.run('data.tasks[0].text'),'Купить хлеб');
  const raw=h.storage.get('encMasterData');assert.ok(raw);assert.equal(raw.includes('Купить хлеб'),false);
  assert.equal(JSON.parse(CryptoJS.AES.decrypt(raw,'fixture-key').toString(CryptoJS.enc.Utf8)).tasks.length,1);
});
test('daily metric input rejects invalid values without changing data',()=>{
  const h=harness();assert.equal(h.run("recordDailyMetric('water',250)"),true);assert.equal(h.run("getTodayData().water"),250);
  for(const value of ['-1','0','NaN','Infinity','2.4']) assert.equal(h.run(`recordDailyMetric('water',${value})`),false);
  assert.equal(h.run("recordDailyMetric('unknown',100)"),false);
  assert.equal(h.run("getTodayData().waterList.length"),1);
});
test('locked vault cannot create tasks or record health data',()=>{
  const h=harness();h.run("masterKey=''");assert.equal(h.run("createTask('hidden')"),false);assert.equal(h.run("recordDailyMetric('steps',1000)"),false);assert.equal(h.storage.size,0);
});
test('legacy encrypted backup restores with defaults and retains debts and credentials',()=>{
  const h=harness();const original={days:{},tasks:[{text:'old',done:false}],debts:[{who:'Friend',amount:-500}],vault:[{name:'mail',pwd:'private'}]};
  h.context.fixture=CryptoJS.AES.encrypt(JSON.stringify(original),'fixture-key').toString();
  h.run('restoreEncryptedBackup(fixture)');assert.equal(h.run('data.debts[0].amount'),-500);assert.equal(h.run('data.vault[0].pwd'),'private');assert.equal(h.run('data.profile.targetWater'),2500);assert.equal(h.run('data.budget.transactions.length'),0);
});
test('wrong password, malformed JSON and invalid schema never replace existing storage',()=>{
  const h=harness();h.storage.set('encMasterData','original');
  for(const text of ['not-json',JSON.stringify({days:{},tasks:'invalid'}),JSON.stringify([])]){
    h.context.fixture=CryptoJS.AES.encrypt(text,'fixture-key').toString();
    assert.throws(()=>h.run('restoreEncryptedBackup(fixture)'));assert.equal(h.storage.get('encMasterData'),'original');
  }
  h.context.fixture=CryptoJS.AES.encrypt(JSON.stringify({days:{}}),'other-key').toString();assert.throws(()=>h.run('restoreEncryptedBackup(fixture)'));assert.equal(h.storage.get('encMasterData'),'original');
});
test('failed storage write cannot replace the live state',()=>{
  const h=harness();h.context.fixture=CryptoJS.AES.encrypt(JSON.stringify({days:{},tasks:[{text:'replacement'}]}),'fixture-key').toString();
  h.run("localStorage.setItem=()=>{throw new Error('Quota exceeded')}");assert.throws(()=>h.run('restoreEncryptedBackup(fixture)'));assert.equal(h.run('data.tasks.length'),0);
});
