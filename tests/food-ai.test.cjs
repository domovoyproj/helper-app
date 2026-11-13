const {test} = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../food-ai.js');
const meal = {is_food:true,name:'Омлет',cal:280,p:20,f:18,c:4,health_score:7,health_comment:'Белок и жиры'};
const model = {name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']};
const result = value => ({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
const ok = value => ({ok:true,status:200,json:async()=>value});

test('discovers a supported model and requests structured text output without a key in the URL',async()=>{
  const calls=[];
  const answer=await AI.analyze({key:'fixture-key',text:'Омлет 200 г',fetchImpl:async(url,options)=>{calls.push({url,options});return ok(calls.length===1?{models:[model]}:result(meal));}});
  assert.equal(answer.meal.cal,280);assert.equal(calls.length,2);
  assert.ok(calls[1].url.endsWith('models/gemini-3.5-flash:generateContent'));
  assert.equal(calls[1].url.includes('fixture-key'),false);
  assert.equal(calls[1].options.headers['x-goog-api-key'],'fixture-key');
  const body=JSON.parse(calls[1].options.body);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.ok(body.contents[0].parts[0].text.includes('Омлет 200 г'));
});
test('photo uses the documented inlineData request shape',async()=>{
  let sent;
  await AI.analyze({key:'test',text:'',image:{type:'image/jpeg',base64:'image-data'},fetchImpl:async(url,options)=>{
    if(!options.body)return ok({models:[model]});sent=JSON.parse(options.body);return ok(result(meal));
  }});
  assert.deepEqual(sent.contents[0].parts[1],{inlineData:{mimeType:'image/jpeg',data:'image-data'}});
});
test('Safari Load failed produces a network message and never tries extra models',async()=>{
  let count=0;
  await assert.rejects(AI.analyze({key:'test',text:'еда',fetchImpl:async()=>{count++;throw new TypeError('Load failed');}}),e=>e.code==='network'&&e.message.includes('Google API'));
  assert.equal(count,1);
});
test('quota and access failures are not hidden by fallback attempts',async()=>{
  for(const [status,code] of [[429,'quota'],[403,'permission'],[402,'billing'],[404,'model'],[503,'server']]){
    let count=0;
    await assert.rejects(AI.analyze({key:'test',text:'еда',fetchImpl:async()=>{count++;return {ok:false,status,json:async()=>({error:{message:'error'}})};}}),e=>e.code===code);
    assert.equal(count,1);
  }
});
test('invalid key and location errors remain distinguishable',()=>{
  assert.equal(AI.apiError(400,{error:{message:'API key not valid'}}).code,'key');
  assert.equal(AI.apiError(400,{error:{message:'User location is not supported'}}).code,'region');
});
test('thought parts are excluded and final text fragments are joined',()=>{
  const text=JSON.stringify(meal);
  const response={candidates:[{content:{parts:[{thought:true,text:'private reasoning'},{text:text.slice(0,20)},{text:text.slice(20)}]},finishReason:'STOP'}]};
  assert.equal(AI.parseMeal(response).name,'Омлет');
});
test('malformed, non-food, blocked and truncated responses never become zero-calorie meals',()=>{
  for(const response of [result({...meal,cal:'unknown'}),result({...meal,p:-1}),result({...meal,health_score:99}),result({is_food:false}),{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'MAX_TOKENS'}]}])assert.throws(()=>AI.parseMeal(response));
});
test('model discovery respects pagination and excludes audio/image-only models',async()=>{
  let count=0;
  const selected=await AI.discoverModel('test',{fetchImpl:async()=>ok(++count===1?{models:[{...model,name:'models/gemini-9-image'}],nextPageToken:'second'}:{models:[model]})});
  assert.equal(selected,model.name);assert.equal(count,2);
});
test('timeout and cancellation are separate, bounded outcomes',async()=>{
  const fake=async(url,{signal})=>new Promise((resolve,reject)=>{if(signal.aborted)reject(new Error('aborted'));else signal.addEventListener('abort',()=>reject(new Error('aborted')));});
  await assert.rejects(AI.request('models','test',{fetchImpl:fake,timeout:5}),e=>e.code==='timeout');
  const controller=new AbortController();controller.abort();
  await assert.rejects(AI.request('models','test',{fetchImpl:fake,signal:controller.signal}),e=>e.code==='cancelled');
});

test('server mode never contacts Google from the browser and validates the returned meal',async()=>{
 const calls=[];
 const response=await AI.analyze({key:'fixture-key',text:'Яблоко',server:'https://helper.example',fetchImpl:async(url,options)=>{calls.push({url,options});return ok({meal,model:model.name});}});
 assert.equal(response.meal.cal,280);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://helper.example/v1/analyze');
 assert.equal(calls[0].options.credentials,'omit');assert.deepEqual(JSON.parse(calls[0].options.body),{text:'Яблоко'});
 await assert.rejects(AI.analyze({key:'test',text:'еда',server:'https://helper.example',fetchImpl:async()=>ok({meal:{...meal,cal:'invalid'}})}),e=>e.code==='response');
});
test('server generation check uses the check endpoint and never falls back to a blocked Google connection',async()=>{
 let calls=0;
 await assert.rejects(AI.check({key:'test',server:'https://helper.example',fetchImpl:async(url)=>{calls++;assert.equal(url,'https://helper.example/v1/check');return {ok:false,status:429,json:async()=>({error:{code:'quota',message:'Лимит'}})};}}),e=>e.code==='quota');
 assert.equal(calls,1);
 await assert.rejects(AI.analyze({key:'test',text:'x',server:'http://external.example'}),e=>e.code==='config');
});
