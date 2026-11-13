// Optional browser suite: set PLAYWRIGHT_MODULE and CHROME_PATH when using bundled tools.
const {chromium,webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const baseURL = process.env.HELPER_URL || 'http://127.0.0.1:8765';

(async()=>{
  const engine = process.env.HELPER_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({headless:true,...(engine === chromium && process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1080}});
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'1000':undefined));
    await page.goto(baseURL);
    await page.locator('#master-password').fill('browser-test-key');
    await page.locator('[onclick="unlockVault()"]').click();
    await page.locator('#dashboard-page.active').waitFor();
    await page.locator('[onclick="openFocusTask()"]').click();
    await page.locator('#focus-input').fill('Проверить новый Helper');
    await page.locator('#focus-input').press('Enter');
    assert.equal(await page.locator('#focus-list .focus-task').count(),1);
    await page.locator('#focus-list input').click();
    assert.equal(await page.locator('#focus-list .focus-task').count(),0);
    await page.evaluate(()=>showSection('planner-page'));
    await page.locator('[data-task-filter="done"]').click();
    assert.equal(await page.locator('#tasks-list .done').count(),1);
    await page.locator('#tasks-list input').click();
    await page.locator('[data-task-filter="all"]').click();
    await page.locator('#task-search').fill('НЕСУЩЕСТВУЮЩЕЕ');
    assert.equal(await page.locator('#tasks-list .list-item').count(),0);
    await page.locator('#task-search').fill('Helper');
    assert.equal(await page.locator('#tasks-list .list-item').count(),1);
    await page.evaluate(()=>showSection('dashboard-page'));
    await page.locator('[onclick="openDailyMetric(\'water\',true)"]').click();
    await page.locator('#metric-form button[type=submit]').click();
    assert.equal(await page.locator('#daily-water').textContent(),'250');
    await page.locator('[onclick="openDailyMetric(\'water\',true)"]').click();
    await page.locator('[data-metric-value="500"]').click();
    await page.locator('#metric-form button[type=submit]').click();
    await page.locator('[onclick="openDailyMetric(\'water\',true)"]').click();
    await page.locator('#metric-amount').fill('175');
    await page.locator('#metric-form button[type=submit]').click();
    assert.equal(await page.locator('#daily-water').textContent(),'925');
    await page.evaluate(()=>{showSection('health-page');changeDate(-1);});
    await page.locator('.health-entry-actions button').getByText('Добавить воду',{exact:true}).click();
    await page.locator('#metric-amount').fill('333');await page.locator('#metric-form button[type=submit]').click();
    assert.equal(await page.evaluate(()=>getTodayData().water),333);
    await page.evaluate(()=>showSection('budget-page'));
    await page.locator('#tx-amount').fill('450');
    await page.locator('[onclick="addBudgetTransaction()"]').click();
    assert.equal(await page.locator('#budget-transactions-list .tx-item').count(),1);
    await page.evaluate(()=>showSection('calendar-page'));
    await page.locator('#cal-grid .cal-day').first().click();
    assert.ok(await page.locator('#cal-grid .shift-day').count());
    await page.evaluate(()=>showSection('vault-page'));
    await page.locator('[onclick="openAddVaultModal()"]').click();
    await page.locator('#add-name').fill('Test service');await page.locator('#add-user').fill('test-user');await page.locator('#add-pwd').fill('private-password');
    await page.locator('#save-vault-btn').click();
    await page.locator('#vault-page.active').waitFor();
    assert.equal(await page.locator('.vault-service-name').textContent(),'Test service');
    await page.keyboard.press('Control+k');await page.locator('#command-input').fill('Финансы');await page.locator('#command-input').press('Enter');
    await page.locator('#budget-page.active').waitFor();
    await page.evaluate(()=>lockVault());
    assert.equal(await page.locator('#vault-list').textContent(),'');
    await page.locator('#master-password').fill('browser-test-key');await page.locator('[onclick="unlockVault()"]').click();
    assert.equal(await page.locator('#daily-water').textContent(),'925');
    assert.equal(await page.evaluate(()=>data.vault[0].pwd),'private-password');
    const backup=await page.evaluate(()=>localStorage.getItem('encMasterData'));
    await page.evaluate(()=>{data.tasks=[];saveEncrypted();});
    await page.evaluate(()=>showSection('settings-page'));
    await page.locator('#dash-import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
    await page.locator('#dashboard-page.active').waitFor();
    assert.equal(await page.locator('#focus-list .focus-task').count(),1);
    await page.evaluate(()=>setAppearance('theme','dark'));assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.evaluate(()=>setAppearance('theme','light'));
    const routes=['dashboard-page','more-page','planner-page','health-page','budget-page','calendar-page','vault-page','misc-page','settings-page','profile-page','export-page','food-page','add-vault-page'];
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:900});
      for(const route of routes){
        await page.evaluate(route=>showSection(route),route);
        assert.ok(await page.locator('#'+route).isVisible(),route);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} overflows ${width}`);
      }
    }
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.locator('#master-password').fill('browser-test-key');await page.locator('[onclick="unlockVault()"]').click();
    // Playwright's Windows WebKit runtime fails internally on offline navigation.
    // Verify this path in Chromium; do not count it as an iOS offline verification.
    if (engine === chromium) {
      await context.setOffline(true);await page.reload();
      await page.locator('#master-password').fill('browser-test-key');await page.locator('[onclick="unlockVault()"]').click();await page.locator('#dashboard-page.active').waitFor();
      assert.equal(await page.locator('#daily-water').textContent(),'925');
      await context.setOffline(false);
    }
    assert.deepEqual(errors,[]);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#helper-dock [data-route="more-page"]').click();
    await page.locator('#more-page button').filter({hasText:'Настройки'}).click();
    await page.locator('#settings-page.active').waitFor();
    if (engine === webkit) { console.log('PASS WebKit: workflows, custom water (175/333/500 ml), all sections and responsive layouts. Offline navigation excluded: Windows WebKit runtime limitation.'); return; }
    // Capture real empty-state views in a separate, clean browser profile.
    const clean=await browser.newContext({viewport:{width:1440,height:1080}});const shot=await clean.newPage();await shot.goto(baseURL);
    const output=path.join(__dirname,'../docs/screenshots');fs.mkdirSync(output,{recursive:true});
    await shot.screenshot({animations:'disabled',path:path.join(output,'welcome-desktop.png'),fullPage:true});
    await shot.locator('#master-password').fill('screenshot-only');await shot.locator('[onclick="unlockVault()"]').click();await shot.mouse.move(0,0);
    await shot.screenshot({animations:'disabled',path:path.join(output,'today-desktop.png'),fullPage:true});
    await shot.setViewportSize({width:390,height:844});await shot.screenshot({animations:'disabled',path:path.join(output,'today-mobile.png'),fullPage:true});
    await shot.setViewportSize({width:1440,height:1080});await shot.evaluate(()=>showSection('budget-page'));await shot.screenshot({animations:'disabled',path:path.join(output,'finance-desktop.png'),fullPage:true});
    assert.notEqual(await shot.locator('#budget-month-balance').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
    await shot.evaluate(()=>{setAppearance('theme','dark');showSection('dashboard-page');});await shot.screenshot({animations:'disabled',path:path.join(output,'today-dark.png'),fullPage:true});
    console.log('PASS: tasks, health, finance, shifts, vault, search, lock/unlock, backup import, themes, 52 responsive route checks and offline reload.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
