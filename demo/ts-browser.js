// https://github.com/harrysolovay/ts-browser
// and
// https://github.com/xitu/inline-module
// and
// https://glitch.com/edit/#!/typescript-in-browser?path=service-worker.js%3A15%3A0
// mooshed together until they worked.

const tsTranspiledEvent = new Event('tsTranspiled');

function createBlob(code, type = 'text/plain') {
  const blob = new Blob([code], {type});
  const blobURL = URL.createObjectURL(blob);
  return blobURL;
}

window.addEventListener('DOMContentLoaded', async () => {
  const scripts = document.getElementsByTagName('script');

  // Register the Service Worker which will polyfill the HTML module behavior.
  await navigator.serviceWorker.register('./demo-sw.js');

  // Unfortunately, we have to wait for the Service Worker to ready before
  // actually loading the application so that it can intercept the HTML requests.
  await navigator.serviceWorker.ready.then(async worker => {

    // Next up is to compile the inline typescript present on the page.
    // Pick up their contents, yeet them at the compiler, and then load the result as a URL blob
    // so that modules will load properly.
    let pending = [];
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].type === 'text/typescript') {
        pending.push(
          new Promise(resolve => {
            worker.active.postMessage([`Inline script tag ${i}`, scripts[i].innerHTML]);

            navigator.serviceWorker.onmessage = async ({ data: transpiled }) => {
              // In order for the browser to treat this as the es6 module it is
              // we must trick it into 'loading' it. We encode it into a blob URL
              // and then 'import' that.

              // TODO: Post it externally and then load it inline so it looks more normal?
              var scriptAsBlob = createBlob(transpiled, 'text/javascript')
              await import(scriptAsBlob);
              resolve();
            }
          }),
        )
      }
    }

    await Promise.all(pending);
    window.dispatchEvent(tsTranspiledEvent);
  });
});
