const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const engine=process.env.HELPER_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.HELPER_URL || 'http://127.0.0.1:8765');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#master-password').fill('mobile-test');await page.locator('[onclick="unlockVault()"]').click();
  const aboveDock=async selector=>{
   const box=await page.locator(selector).boundingBox(),dock=await page.locator('#helper-dock').boundingBox();
   assert.ok(box&&box.y>=0&&box.y+box.height<=dock.y,selector+' must be immediately visible');assert.ok(box.height>=44,selector+' touch size');
  };
  await aboveDock('[onclick="openDailyMetric(\'water\',true)"]');await aboveDock('[onclick="openTodayHealth(\'food\')"]');
  const screenshot=async name=>{if(engine===chromium)await page.screenshot({path:path.join(__dirname,'../docs/screenshots',name),animations:'disabled'});};
  await screenshot('today-mobile-dark.png');
  await page.locator('#dashboard-page [data-theme-toggle]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.locator('#master-password').fill('mobile-test');await page.locator('[onclick="unlockVault()"]').click();
  await page.locator('#helper-dock [data-route="more-page"]').click();
  await aboveDock('#more-page [data-theme-choice="dark"]');
  await page.locator('#more-page [data-theme-choice="dark"]').click();assert.equal(await page.locator('#more-page [data-theme-choice="dark"]').getAttribute('aria-pressed'),'true');
  await screenshot('menu-mobile-dark.png');
  await page.locator('#more-page button').filter({hasText:'Настройки'}).click();await aboveDock('.settings-save');
  await page.locator('#gh-repo-input').scrollIntoViewIfNeeded();await aboveDock('.settings-save');
  await page.evaluate(()=>showSection('more-page'));
  await page.locator('#more-page [data-theme-choice="system"]').click();await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.evaluate(()=>showSection('calendar-page'));await aboveDock('#cal-grid');
  assert.equal(await page.locator('.secondary-settings[open]').count(),0);
  await page.locator('.secondary-settings summary').first().click();assert.ok(await page.locator('#t-1').isVisible());
  await page.locator('.secondary-settings summary').first().click();await screenshot('calendar-mobile-dark.png');
  await page.evaluate(()=>showSection('planner-page'));await aboveDock('.task-entry button');
  await page.locator('#helper-dock [data-route="budget-page"]').click();await aboveDock('[onclick="focusBudgetEntry(\'expense\')"]');
  await page.locator('[onclick="focusBudgetEntry(\'income\')"]').click();assert.ok(await page.locator('#tx-amount').evaluate(el=>el===document.activeElement));
  assert.ok((await page.locator('#btn-tx-income').getAttribute('class')).includes('active-income'));
  await page.evaluate(()=>showSection('health-page'));await page.locator('#tx-amount').evaluate(el=>el.blur());
  await aboveDock('[onclick="openDailyMetric(\'water\')"]');await screenshot('health-mobile-dark.png');
  await page.locator('[onclick="openDailyMetric(\'water\')"]').click();
  assert.equal(await page.locator('#metric-dialog').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(34, 35, 38)');
  assert.equal(await page.locator('#metric-amount').evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.locator('#metric-amount').fill('330');await page.locator('#metric-form [type=submit]').click();assert.equal(await page.evaluate(()=>getTodayData().water),330);
  const routes=await page.evaluate(()=>Object.keys(workspacePages));
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});for(const route of routes){await page.evaluate(id=>showSection(id),route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' dark overflow '+width);}}
  assert.deepEqual(errors,[]);
  console.log('PASS mobile '+(engine===webkit?'WebKit':'Chromium')+': visible primary actions, dark/system theme, theme persistence, calendar order, expense entry, 44px targets, dark dialogs and 39 dark route layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
