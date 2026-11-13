const {test}=require('node:test');
const assert=require('node:assert/strict');
const AI=require('../food-ai.js');
const meal={is_food:true,name:'Яблоко',cal:52,p:0.3,f:0.2,c:14,health_score:8,health_comment:'Порция фруктов'};
const model={name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']};
const origin='https://domovoyproj.github.io';
async function harness(fetchImpl){const {createFoodWorker}=await import('../backend/worker.mjs');return createFoodWorker(AI,{fetchImpl});}
const input=(path='/v1/analyze',body={text:'Яблоко 100 г'},headers={})=>new Request('https://helper.example'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-goog-api-key':'fixture-key',...headers},body:JSON.stringify(body)});
const upstream=async(url,options)=>new Response(JSON.stringify(options.method==='GET'?{models:[model]}:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(meal)}]}}]}),{status:200});

test('server actually calls Gemini and returns validated food, including a generation-based connection check',async()=>{
 const calls=[];const worker=await harness(async(...args)=>{calls.push(args);return upstream(...args);});
 for(const path of ['/v1/analyze','/v1/check']){const response=await worker.fetch(input(path));assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).meal.cal,52);}
 assert.equal(calls.length,4);assert.ok(calls.every(([url])=>url.startsWith('https://generativelanguage.googleapis.com/v1beta/')));
 assert.ok(calls.every(([,options])=>options.redirect==='manual'&&!('credentials' in options)));
 assert.ok(calls[3][1].body.includes('100 граммов'));assert.ok(calls.every(([url])=>!url.includes('fixture-key')));
});
test('worker never follows a provider redirect with a user credential',async()=>{
 const worker=await harness(async()=>new Response(null,{status:302,headers:{Location:'https://other.example'}}));
 const response=await worker.fetch(input());assert.equal(response.status,502);assert.equal((await response.json()).error.code,'server');
});
test('gateway preflight allows only Helper origin and never needs a shared server key',async()=>{
 const worker=await harness(()=>{throw Error('must not call');});
 const preflight=await worker.fetch(new Request('https://helper.example/v1/analyze',{method:'OPTIONS',headers:{Origin:origin}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-headers'),'content-type,x-goog-api-key');
 assert.equal((await worker.fetch(input('/v1/analyze',{}, {Origin:'https://evil.example'}))).status,403);
 assert.equal((await worker.fetch(input('/v1/analyze',{}, {'x-goog-api-key':''}))).status,401);
 assert.equal((await worker.fetch(input('/anything'))).status,404);
});
test('invalid payloads and oversize bodies are rejected before any upstream request',async()=>{
 const worker=await harness(()=>{throw Error('must not call');});
 for(const body of [null,[],{text:''},{text:'x'.repeat(6001)},{text:'x',image:{type:'image/svg+xml',base64:'YQ=='}}])assert.equal((await worker.fetch(input('/v1/analyze',body))).status,400);
 assert.equal((await worker.fetch(input('/v1/analyze',{text:'x'},{'Content-Length':String(13*1024*1024)}))).status,413);
});
test('upstream quota, key and network failures remain errors and never disclose the input or key',async()=>{
 for(const [status,message,expected] of [[429,'secret fixture-key',429],[400,'API key not valid fixture-key',401],[403,'secret fixture-key',403]]){
 const worker=await harness(async()=>new Response(JSON.stringify({error:{message}}),{status}));const response=await worker.fetch(input());assert.equal(response.status,expected);assert.ok(!(await response.text()).includes('fixture-key'));
 }
 const worker=await harness(async()=>{throw new TypeError('Load failed');});const response=await worker.fetch(input());assert.equal(response.status,502);assert.equal((await response.json()).error.code,'network');
});
