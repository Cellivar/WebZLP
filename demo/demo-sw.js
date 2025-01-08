// Has to be a hard version so the URL doesn't redirect, which prevents loading.
// eslint-disable-next-line no-undef
importScripts('https://unpkg.com/typescript@5.7.2/lib/typescript.js');

const log = (...obj) => console.log('SHENANIGANS', ...obj);

self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

// Call clients.claim so that we intercept requests even on initial page load.
self.addEventListener('activate', () => self.clients.claim());

// Intercept fetch requests for modules and compile the intercepted typescript.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
    if (!url.startsWith('https://')) {
        return;
    }

    // Start off easy: if it's a request for a TS file, transpile it.
    if (url.endsWith('.ts')) {
        log('Fetching', url, 'as just typescript');
        event.respondWith(transpileTypeScript(url));
        return;
    }

    // Next up is 'no extension'. In classical TS imports you omit any extension
    // when pulling in a file reference, interpret those as TS and be okay if it
    // ends up 404'ing.
    const notExtensions = [".ts", ".js", ".mjs", ".cjs", ".css", ".json"]
    if (notExtensions.find(e => url.endsWith(e)) === undefined
        && event.request.destination === 'script'
        && event.isTrusted) {
        log("Interpreting", url, "as TypeScript request");
        // TS import statements elide the .ts extension, but this fetch is destined for a script
        // and it's not a javascript file. Assume it's actually a TS module.
        // This is _mostly_ safe as js run through the ts compiler is unmodified.
        event.respondWith(transpileTypeScript(url + '.ts'));
        return;
    }

    // Because TypeScript has chosen violence we have to use .js extensions in
    // import statements. This is considered correct behavior. Sure okay.
    // https://github.com/microsoft/TypeScript/issues/16577#issuecomment-703190339
    // As such, we must test the fetch URL and see if it 404s, if so retry with
    // a .ts extension instead.
    if ((url.endsWith('.js') || url.endsWith('.mjs'))
        && event.request.destination === 'script'
        && event.isTrusted) {
        log('Testing', url, 'as maybe javascript');
        event.respondWith(maybeFetchJs(url));
        return;
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

const maybeFetchJs = async (requestUrl) => {
    const maybeJs = await fetch(requestUrl);
    if (maybeJs.status !== 404) {
        return maybeJs;
    }

    // Try it again with a TS extension
    const tsUrl = requestUrl.substr(0, requestUrl.lastIndexOf('.')) + '.ts';
    log('Rewrote JS URL to', tsUrl, 'and fetching as typescript');
    return transpileTypeScript(tsUrl);
}

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
    if (!requestUrl.startsWith('https://localhost') && requestUrl.startsWith('https://')) {
        typescriptCache.put(requestUrl, transpiledResponse.clone());
    }

    return transpiledResponse;
}
