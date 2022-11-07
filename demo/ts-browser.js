// https://github.com/harrysolovay/ts-browser
// and
// https://github.com/xitu/inline-module
// mooshed together until they worked.

const tsTranspiledEvent = new Event('tsTranspiled');

const workerFile = window.URL.createObjectURL(
  new Blob(
    [
      `
        importScripts('https://unpkg.com/typescript@latest')
        const load = sourceUrl => {
          const xhr = XMLHttpRequest
            ? new XMLHttpRequest()
            : ActiveXObject
            ? new ActiveXObject('Microsoft.XMLHTTP')
            : null
          if (!xhr) return ''
          xhr.open('GET', sourceUrl, false)
          xhr.overrideMimeType && xhr.overrideMimeType('text/plain')
          xhr.send(null)
          return xhr.status == 200 ? xhr.responseText : ''
        }
        onmessage = ({data: [sourceUrl, sourceCode]}) => {
          const raw = sourceCode ? sourceCode : load(sourceUrl)
          const transpiled = ts.transpile(raw, {
            "module": "es6",
            "target": "esnext",
            "lib": ["dom", "esnext"]
          })
          postMessage(transpiled)
        }
      `
    ],
    { type: 'text/javascript' }
  )
);

function createBlob(code, type = 'text/plain') {
  const blob = new Blob([code], {type});
  const blobURL = URL.createObjectURL(blob);
  return blobURL;
}

window.addEventListener('DOMContentLoaded', async () => {
  const scripts = document.getElementsByTagName('script');
  let pending = [];

  // Because we do this typescript hop shenanigans we don't generate proper modules
  // that can be interpreted by the browser. We still want to export the things
  // that should be exported, but we can't rely on imports working. We solve this
  // by mooshing all of the typescript together, running the compiler over that,
  // and then 'importing' that whole thing in one go.
  let combined = "console.log('Click the line number to jump to the compiled source');";
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].type === 'text/typescript') {
      const { src } = scripts[i];
      const innerHtml = src ? null : scripts[i].innerHTML;
      const url = innerHtml ? "INLINE SCRIPT" : src;
      let raw = innerHtml ? innerHtml : (await fetch(src).then(r => r.text()));

      // Strip imports so we avoid 'already has been declared' errors.
      raw = raw.replaceAll(/^import\s+[\{\*]+[^;]*;/gm, '');
      combined += '\n//\n//\n// ' + url + '\n//\n//\n' + raw;
    }
  }

  pending.push(
    new Promise((resolve) => {
      const w = new Worker(workerFile);
      w.postMessage([null, combined]);
      w.onmessage = async ({ data: transpiled }) => {
        // In order for the browser to treat this as the es6 module it is
        // we must trick it into 'loading' it. We encode it into a blob URL
        // and then 'load' that.

        // TODO: Post it externally and then load it inline so it looks more normal?
        var scriptAsBlob = createBlob(transpiled, 'text/javascript')
        const result = await import(scriptAsBlob);
        console.log("Load module result: ");
        console.log(result);
        resolve();
      };
    })
  );

  await Promise.all(pending);
  window.dispatchEvent(tsTranspiledEvent);
});
