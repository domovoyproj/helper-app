// Real browser -> HTTP gateway -> fixture upstream. Direct Google is blocked.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http'),assert=require('node:assert/strict');
const AI=require('../food-ai.js');
(async()=>{
 const {createFoodWorker}=await import('../backend/worker.mjs');
 const base=process.env.HELPER_URL || 'http://127.0.0.1:8765';let generated=0,mode='ok';
 const meal={is_food:true,name:'Яблоко',cal:52,p:0.3,f:0.2,c:14,health_score:8,health_comment:'Фрукты'};
 const worker=createFoodWorker(AI,{allowedOrigin:new URL(base).origin,fetchImpl:async(url,options)=>{
   if(options.method==='GET')return new Response(JSON.stringify({models:[{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']}]}));
   generated++;if(mode==='quota')return new Response(JSON.stringify({error:{message:'quota'}}),{status:429});
   return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(meal)}]}}]}));
 }});
 const server=http.createServer(async(req,res)=>{
   try{const buffers=[];for await(const chunk of req)buffers.push(chunk);const body=Buffer.concat(buffers);
   const request=new Request('http://127.0.0.1:8766'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )});
   const response=await worker.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   }catch(e){res.writeHead(500);res.end('Test server error');}
 });
 await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
 const engine=process.env.HELPER_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
   const page=await browser.newPage();let directCalls=0;
   await page.route('https://generativelanguage.googleapis.com/**',route=>{directCalls++;return route.abort('failed');});
   await page.goto(base);await page.locator('#master-password').fill('test-only');await page.locator('[onclick="unlockVault()"]').click();
   await page.evaluate(()=>{window.HELPER_FOOD_SERVER='http://127.0.0.1:8766';data.geminiApiKey='fixture-key';showSection('food-page');});
   await page.locator('#food-input').fill('Яблоко 100 г');await page.locator('#analyze-btn').click();await page.locator('#save-meal-btn').waitFor();
   assert.equal(generated,1);assert.equal(directCalls,0);assert.equal(await page.evaluate(()=>getTodayData().meals.length),0);
   await page.locator('#save-meal-btn').click();assert.equal(await page.evaluate(()=>getTodayData().calories),52);
   await page.evaluate(()=>showSection('settings-page'));await page.locator('#gemini-check').click();await page.waitForFunction(()=>document.getElementById('gemini-check-status').textContent.startsWith('Оценка работает'));
   assert.equal(generated,2);assert.equal(directCalls,0);
   mode='quota';await page.evaluate(()=>showSection('food-page'));await page.locator('#food-input').fill('Омлет');await page.locator('#analyze-btn').click();
   await page.waitForFunction(()=>document.getElementById('food-status').textContent.includes('Лимит'));assert.equal(await page.locator('#food-input').inputValue(),'Омлет');assert.equal(await page.evaluate(()=>getTodayData().meals.length),1);
   console.log(`PASS ${engine===webkit?'WebKit':'Chromium'}: browser Google access blocked, server path generates and saves meal; full generation check; quota preserved.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
