// AI response fixtures exercise the UI without using a personal key or paid quota.
const {chromium,webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async()=>{
    const engine = process.env.HELPER_BROWSER === 'webkit' ? webkit : chromium;
    const browser = await engine.launch({headless:true,...(engine === chromium && process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
    try {
        const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
        const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
        let mode='network', requests=0, generateBody=null, release=null;
        const meal={name:'Омлет',is_food:true,cal:280,p:20,f:18,c:4,health_score:7,health_comment:'Белок и жиры'};
        await context.route('https://generativelanguage.googleapis.com/**',async route=>{
            requests++;
            if(mode==='network') return route.abort('failed');
            if(route.request().method()==='GET')return route.fulfill({json:{models:[{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']}]}});
            generateBody=route.request().postDataJSON();
            if(mode==='quota')return route.fulfill({status:429,json:{error:{message:'quota'}}});
            if(mode==='delayed')await new Promise(resolve=>{release=resolve;});
            await route.fulfill({json:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(mode==='invalid'?{...meal,cal:'broken'}:meal)}]}}]}}).catch(()=>{});
        });
        await page.goto(process.env.HELPER_URL || 'http://127.0.0.1:8765');
        await page.locator('#master-password').fill('browser-fixture');await page.locator('[onclick="unlockVault()"]').click();
        await page.evaluate(()=>{window.HELPER_FOOD_SERVER='';data.geminiApiKey='fixture-key';showSection('food-page');});
        await page.locator('#food-input').fill('Омлет из двух яиц');await page.locator('#analyze-btn').click();
        await page.locator('#food-status.is-error').waitFor();assert.match(await page.locator('#food-status').textContent(),/Нет соединения/);assert.equal(requests,1);
        assert.equal(await page.locator('#food-input').inputValue(),'Омлет из двух яиц');
        assert.equal(await page.evaluate(()=>getTodayData().meals.length),0);
        mode='ok';await page.locator('#analyze-btn').click();await page.locator('#save-meal-btn').waitFor();
        assert.equal(await page.evaluate(()=>getTodayData().meals.length),0);
        await page.locator('#save-meal-btn').click();assert.equal(await page.evaluate(()=>getTodayData().meals.length),1);
        await page.evaluate(()=>saveAnalyzedMeal());assert.equal(await page.evaluate(()=>getTodayData().meals.length),1);
        assert.equal(generateBody.generationConfig.responseMimeType,'application/json');
        await page.locator('#food-input').fill('Рис 100 г');mode='quota';await page.locator('#analyze-btn').click();
        await page.waitForFunction(()=>document.getElementById('food-status').textContent.includes('Лимит'));assert.equal(await page.evaluate(()=>getTodayData().meals.length),1);
        mode='invalid';await page.locator('#analyze-btn').click();await page.waitForFunction(()=>document.getElementById('food-status').textContent.includes('некорректные'));assert.equal(await page.evaluate(()=>getTodayData().meals.length),1);
        mode='ok';await page.locator('#food-input').fill('');
        await page.locator('#food-image').setInputFiles({name:'food.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
        await page.locator('#analyze-btn').click();await page.locator('#save-meal-btn').waitFor();assert.equal(generateBody.contents[0].parts[1].inlineData.mimeType,'image/png');
        const originalDate=await page.evaluate(()=>currentDateStr);await page.evaluate(()=>{currentDateStr='2020-01-01';});await page.locator('#save-meal-btn').click();
        assert.equal(await page.evaluate(date=>data.days[date].meals.length,originalDate),2);assert.equal(await page.evaluate(()=>getTodayData().meals.length),0);
        mode='delayed';await page.locator('#food-input').fill('Суп');await page.locator('#analyze-btn').click();
        for(let tries=0;!release&&tries<50;tries++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(release);
        await page.evaluate(()=>lockVault());release();await page.locator('#auth-page.active').waitFor();assert.equal(await page.evaluate(()=>pendingMeal),null);
        assert.equal(await page.locator('#food-result').isVisible(),false);assert.deepEqual(errors,[]);
        console.log(`PASS ${engine.name()}: network failure, retained input, retry, preview, single save, quota, malformed response, photo, captured date, lock cancellation.`);
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
