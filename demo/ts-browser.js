// https://github.com/harrysolovay/ts-browser

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
          const transpiled = ts.transpile(raw)
          postMessage(transpiled)
        }
      `
    ],
    { type: 'text/javascript' }
  )
);

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

window.addEventListener('DOMContentLoaded', async () => {
  const scripts = document.getElementsByTagName('script');
  let pending = [];

  // TS doesn't generate import/export statements in a way that can be executed
  // property by the browser. Instead we concatenate all of the ts references
  // into a single 'script' and compile that. This works, mostly.
  let combined = "";
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].type === 'text/typescript') {
      const { src } = scripts[i];
      const innerHtml = src ? null : scripts[i].innerHTML;
      let raw = innerHtml ? innerHtml : load(src);

      // Export statements are handled, strip imports
      raw = raw.replaceAll(/^import\s+\{[^;]*;/gm, '');

      console.log(raw);
      combined += "\n" + raw;
    }
  }

  pending.push(
    new Promise((resolve) => {
      const w = new Worker(workerFile);
      w.postMessage([null, combined]);
      w.onmessage = ({ data: transpiled }) => {
        const newScript = document.createElement('script');
        // Exports must be defined for the `export` statement to work properly.
        // We then namespace the resulting exports where we can find them.
        newScript.innerHTML = `window.addEventListener('tsTranspiled', function() {
          let exports = {};
          ${transpiled}
          window.tsexports = exports;
        })`;
        // Assume ts-browser.js is the first script, replace it.
        // TODO: probably make this more robust.
        scripts[0].replaceWith(newScript);
        //scripts[i].replaceWith(newScript);
        resolve();
      };
    })
  );

  await Promise.all(pending);
  window.dispatchEvent(tsTranspiledEvent);
});
