// Has to be a hard version so the URL doesn't redirect, which prevents loading.
importScripts('https://unpkg.com/typescript@4.9.3/lib/typescript.js');

const log = (...obj) => console.log('SHENANIGANS', ...obj);

self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

// Call clients.claim so that we intercept requests even on initial page load.
self.addEventListener('activate', () => self.clients.claim());

// Intercept fetch requests for modules and compile the intercepted typescript.
self.addEventListener('fetch', (event) => {
    if (!event.request.url.endsWith('.ts')
        && !event.request.url.endsWith('.js')
        && event.request.destination === 'script'
        && event.isTrusted) {
        log("Interpreting", event.request.url, "as TypeScript request");
        // TS import statements elide the .ts extension, but this fetch is destined for a script
        // and it's not a javascript file. Assume it's actually a TS module.
        // This is _mostly_ safe as js run through the ts compiler is unmodified.
        event.respondWith(transpileTypeScript(event.request.url + '.ts'));
    }

    if (event.request.url.endsWith('.ts')) {
        event.respondWith(transpileTypeScript(event.request.url));
    }
});

// Perform on-demand compile of typescript when it's requested by the page.
self.addEventListener('message', async ({data: [sourceUrl, sourceCode]}) => {
    const transpiled = await runTranspile(sourceUrl, sourceCode);
    self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
    }).then((clients) => {
        if (clients && clients.length) {
          clients[0].postMessage(transpiled);
        }
    });
});

const runTranspile = async (src, code) => {
    log('Compiling:', src);
    return await self.ts.transpile(code, {
        "module": "es6",
        "target": "esnext",
        "lib": ["dom", "esnext"]
    });
}

const transpileTypeScript = async (requestUrl) => {
    const response = await fetch(requestUrl); // Fetch the TypeScript code
    const code = await response.text(); // Get the TypeScript code as a string

    const typescriptCache = await caches.open('typescript');
    const cachedResponse = await typescriptCache.match(requestUrl);
    if (cachedResponse && response.headers.get('etag') === cachedResponse.headers.get('etag')) {
        log('Using compile cache:', requestUrl);
        return cachedResponse;
    }

    const transpiledCode = await runTranspile(requestUrl, code);
    const responseOptions = { // Return the transpiled code as the appropriate content type
        headers: {
            'Content-Type': 'application/javascript',
            etag: response.headers.get('etag')
        },
    };

    const transpiledResponse = new Response(transpiledCode, responseOptions);
    if (!requestUrl.startsWith('https://localhost')) {
        typescriptCache.put(requestUrl, transpiledResponse.clone());
    }

    return transpiledResponse;
}
