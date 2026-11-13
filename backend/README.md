# Food assessment server

Production: https://domovoy-helper-food.domovoy2969.chatgpt.site

Sites project: `appgprj_6af65df404dc8191a518bf5edd469a41`. Reuse this identity for updates; do not create another Site. Frontend publication remains GitHub Pages.

`worker.mjs` exposes `/v1/analyze`, `/v1/check`, and `/health`. Browser requests are accepted only from `https://domovoyproj.github.io`. The Gemini key is supplied in `x-goog-api-key` for each request. There is no shared key, account database, persisted request body, or application logging of credentials or food. Hosting request metadata may be retained by the platform. CORS is a browser boundary, not authentication; Google authenticates each supplied key and applies its quota.

Only food analysis is implemented: no caller-controlled destination, model, raw prompt, or arbitrary proxy route. Request sizes and input types are bounded. Provider redirects are rejected without forwarding credentials. Workers uses `redirect: 'manual'` because it does not support browser `redirect: 'error'` ([Cloudflare Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/)). Both the gateway and client validate the result before saving.

Build the Worker module from the same `food-ai.js` used by the client:

```sh
node backend/build.cjs
```

Output: `backend/dist/server/index.js`. For Sites, copy the generated module to the selected Site source checkout, build it as `dist/server/index.js`, and retain that checkout's `.openai/hosting.json` and the project ID above. Publish through the Sites source/version workflow. The deployed server and frontend must both be updated when changing the API contract. Do not put user credentials in either repository or deployment configuration.

`food-config.js` sets the public server origin. An empty value uses the direct Google path for local development only. The production app uses the server first and does not silently retry a possibly billable request through another route.

`tests/food-server.test.cjs` verifies API bounds, CORS, credentials, response validation and redirect handling. `tests/food-gateway-browser.cjs` runs a real local HTTP gateway with fixture Gemini replies while blocking browser access to Google. The Settings check performs an actual Gemini generation on explicit user action.
