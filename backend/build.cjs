// Package the same validated Gemini implementation used by the static client.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2] || path.join(root,'backend/dist/server/index.js'));
fs.mkdirSync(path.dirname(output),{recursive:true});
const ai=fs.readFileSync(path.join(root,'food-ai.js'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'worker.mjs'),'utf8');
fs.writeFileSync(output,`const FoodAI = (() => { const module = {exports:{}};\n${ai}\nreturn module.exports; })();\n${worker}\nexport default createFoodWorker(FoodAI);\n`);
console.log('Built food gateway');
