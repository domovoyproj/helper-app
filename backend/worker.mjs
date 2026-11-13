// A food-only gateway. Credentials and descriptions live in request memory only.
// The caller supplies their own Gemini key; there is no shared project quota.
export function createFoodWorker(ai, {fetchImpl = fetch, allowedOrigin = 'https://domovoyproj.github.io'} = {}) {
    const maxBytes = 12 * 1024 * 1024;
    const reply = (body, status, origin) => new Response(JSON.stringify(body), {
        status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
            'X-Content-Type-Options':'nosniff', 'Vary':'Origin',
            ...(origin === allowedOrigin ? {'Access-Control-Allow-Origin':allowedOrigin} : {})}
    });
    return {async fetch(request) {
        const url = new URL(request.url), origin = request.headers.get('Origin');
        if (url.pathname === '/health' && request.method === 'GET') return reply({service:'helper-food',version:1},200,origin);
        if (!['/v1/analyze','/v1/check'].includes(url.pathname)) return reply({error:{code:'route',message:'Not found'}},404,origin);
        if (origin !== allowedOrigin) return reply({error:{code:'origin',message:'Origin not allowed'}},403,origin);
        if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{
            'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'POST',
            'Access-Control-Allow-Headers':'content-type,x-goog-api-key','Access-Control-Max-Age':'600','Vary':'Origin'
        }});
        if (request.method !== 'POST') return reply({error:{code:'method',message:'POST required'}},405,origin);
        const key = request.headers.get('x-goog-api-key')?.trim();
        if (!key || key.length > 256 || /\s/.test(key)) return reply({error:{code:'key',message:'Введите корректный ключ Gemini.'}},401,origin);
        if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return reply({error:{code:'input',message:'Нужен JSON.'}},415,origin);
        try {
            if (Number(request.headers.get('Content-Length') || 0) > maxBytes) throw new ai.FoodAIError('size','Фото слишком большое. Максимум 8 МБ.');
            // Bound the stream even when Content-Length is absent or inaccurate.
            const reader = request.body?.getReader(), decoder = new TextDecoder();
            let raw = '', bytes = 0;
            if (reader) {
                try { while (true) { const chunk = await reader.read(); if (chunk.done) break;
                    bytes += chunk.value.byteLength;
                    if (bytes > maxBytes) { await reader.cancel(); throw new ai.FoodAIError('size','Фото слишком большое. Максимум 8 МБ.'); }
                    raw += decoder.decode(chunk.value,{stream:true});
                } raw += decoder.decode(); } finally { reader.releaseLock(); }
            }
            let input;
            try { input = JSON.parse(raw); } catch { throw new ai.FoodAIError('input','Некорректный запрос.'); }
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ai.FoodAIError('input','Некорректный запрос.');
            const check = url.pathname === '/v1/check';
            const text = check ? 'Одно яблоко, съедобная часть 100 граммов.' : input.text;
            const image = check ? undefined : input.image;
            if (typeof text !== 'string' || text.length > 6000 || (!text.trim() && !image)) throw new ai.FoodAIError('input','Опишите блюдо: до 6000 символов, или добавьте фото.');
            if (image && (!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(image.type) ||
                typeof image.base64 !== 'string' || !image.base64.length || image.base64.length > 11184812 ||
                image.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64))) throw new ai.FoodAIError('input','Нужно фото JPEG, PNG, WebP или HEIC размером до 8 МБ.');
            const upstream = async (url, options) => {
                // Worker RequestInit supports manual/follow redirects, unlike browsers' error mode.
                // Never follow a redirect with the user's credential.
                const {credentials, ...init} = options;
                const response = await fetchImpl(url,{...init,redirect:'manual'});
                if (response.status >= 300 && response.status < 400) throw new ai.FoodAIError('server','Google вернул неожиданный адрес ответа.');
                return response;
            };
            const result = await ai.analyze({key,text:text.trim(),image,signal:request.signal,fetchImpl:upstream});
            return reply({meal:result.meal,model:result.model,transport:'server'},200,origin);
        } catch (error) {
            if (!(error instanceof ai.FoodAIError)) return reply({error:{code:'server',message:'Сервер оценки временно недоступен.'}},502,origin);
            const status = ({key:401,permission:403,region:403,quota:429,billing:402,input:400,size:413,timeout:504,cancelled:408})[error.code] || 502;
            const message = error.code === 'network' ? 'Сервер Helper не смог связаться с Google. Повторите запрос позже.' : error.message;
            return reply({error:{code:error.code,message}},status,origin);
        }
    }};
}
