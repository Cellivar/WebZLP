# WebZLP

Web USB library for communicating with EPL or ZPL printers.

[![Build](https://github.com/Cellivar/WebZLP/actions/workflows/build_npm.yml/badge.svg)](https://github.com/Cellivar/WebZLP/actions/workflows/build_npm.yml) |

## Demo

See [the demo](https://cellivar.github.io/WebZLP/) that runs in your browser. Note that you will need a browser that supports WebUSB, such as Chrome, Edge, Opera, Chrome on Android, [etc](https://developer.mozilla.org/en-US/docs/Web/API/USB#browser_compatibility).

The demo dynamically compiles the typescript in the browser so can take a minute to spin up.

## Local development

To facilitate local dev you can spin up a local static webserver that will end up operating very similar to GitHub Pages. Clone the repo, run `npm ci` and `npm run serve-local`. On the first time this will run `mkcert` and save the certificate to your machine store, subsequently it will re-use this same cert. Open the server at https://localhost:4443/demo/ to test the app.

* `npm run lint` to run the linter rules.
* `npm run test` to run the tests.
* `npm run build` to run the typescript compiler.

## Copyright information

Much of the technical documenation and information comes from Zebra Technologies Corporation's public documentation and an amount of trial-and-error from working with an array of LP2844 printers with assembly dates between 2000 and 2008.

Zebra have graciously made this information public through reference documentation available on their website. When in doubt please seek their information! The company makes robust printers that continue to be well supported. The latest available printers they manufacture are compatible with EPL command sets dating back to the 90s. I can't recommend them highly enough for any integrator concerned with making sure their systems continue to work into the future.
