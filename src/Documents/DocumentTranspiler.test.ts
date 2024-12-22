import { expect, describe, it } from 'vitest';
import {ReadyToPrintDocuments} from '../ReadyToPrintDocuments.js';
import { getNewTranspileState, PrinterConfig, type TranspiledDocumentState } from '../Commands/index.js';
import { transpileDocument } from './DocumentTranspiler.js';
import { EplPrinterCommandSet, ZplPrinterCommandSet } from '../Languages/index.js';

function getFakeState(): TranspiledDocumentState {
  return getNewTranspileState(new PrinterConfig());
}

describe('DocumentTranspiler', () => {
  describe('EPL', () => {

    const epl = new EplPrinterCommandSet();

    describe('ReadyToPrint Docs', () => {
      it('configDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.configDocument, epl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [
                    QueryConfigurationCommand {
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Query for printer config",
                      "type": "QueryConfiguration",
                    },
                  ],
                  "commands": "
            UQ

            ",
                },
              ],
            }
          `);
      });

      it('printerStatusDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printerStatusDocument, epl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [
                    GetStatusCommand {
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get the immediate printer status",
                      "type": "GetStatus",
                    },
                  ],
                  "commands": "

            ^ee

            ",
                },
              ],
            }
          `);
      });

      it('printConfigDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printConfigDocument, epl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {},
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": "
            U

            ",
                },
              ],
            }
          `);
      });

      it('feedLabelDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.feedLabelDocument, epl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "feedsPaper",
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": "

            N
            P1,0


            ",
                },
                Transaction {
                  "awaitedCommands": [
                    GetStatusCommand {
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get the immediate printer status",
                      "type": "GetStatus",
                    },
                  ],
                  "commands": "

            ^ee

            ",
                },
              ],
            }
          `);
      });

      it('printTestLabelDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printTestLabelDocument(4), epl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "feedsPaper",
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": "

            N
            LO0,0,4,40
            LO0,40,1,20
            LO1,60,1,20
            LO2,80,1,20
            LO3,100,1,20
            LO0,125,1,8
            LO1,133,1,8
            LO2,141,1,8
            LO3,149,1,8
            LO4,125,1,8
            LO5,133,1,8
            LO6,141,1,8
            LO7,149,1,8
            P1,0


            ",
                },
                Transaction {
                  "awaitedCommands": [
                    GetStatusCommand {
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get the immediate printer status",
                      "type": "GetStatus",
                    },
                  ],
                  "commands": "

            ^ee

            ",
                },
              ],
            }
          `);
      });
    });
  });

  describe('ZPL', () => {

    const zpl = new ZplPrinterCommandSet();

    describe('ReadyToPrint Docs', () => {
      it('configDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.configDocument, zpl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "waitsForResponse",
              },
              "language": 2,
              "transactions": [
                Transaction {
                  "awaitedCommands": [
                    CmdXmlQuery {
                      "commandLanguageApplicability": 2,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "XML Super Host Status",
                      "query": "All",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdXmlQuery),
                    },
                    CmdHostConfig {
                      "commandLanguageApplicability": 2,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get host config",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdHostStatus),
                    },
                  ],
                  "commands": "

            ^XA^HZa^HH^XZ

            ",
                },
              ],
            }
          `);
      });

      it('printerStatusDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printerStatusDocument, zpl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "waitsForResponse",
              },
              "language": 2,
              "transactions": [
                Transaction {
                  "awaitedCommands": [
                    CmdHostStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get host status",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdHostStatus),
                    },
                  ],
                  "commands": "
            ~HS

            ",
                },
              ],
            }
          `);
      });

      it('printConfigDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printConfigDocument, zpl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {},
              "language": 2,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": "
            ~WC

            ",
                },
              ],
            }
          `);
      });

      it('feedLabelDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.feedLabelDocument, zpl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "feedsPaper",
                "waitsForResponse",
              },
              "language": 2,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": "

            ^XA^FD ^PQ1,0,0^XZ

            ",
                },
                Transaction {
                  "awaitedCommands": [
                    CmdHostStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get host status",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdHostStatus),
                    },
                  ],
                  "commands": "
            ~HS

            ",
                },
              ],
            }
          `);
      });

      it('printTestLabelDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printTestLabelDocument(4), zpl, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "feedsPaper",
                "waitsForResponse",
              },
              "language": 2,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": "

            ^XA^FO0,0,^GB4,40,4,B,^FS^FO0,40,^GB1,20,1,B,^FS^FO1,60,^GB1,20,1,B,^FS^FO2,80,^GB1,20,1,B,^FS^FO3,100,^GB1,20,1,B,^FS^FO0,125,^GB1,8,1,B,^FS^FO1,133,^GB1,8,1,B,^FS^FO2,141,^GB1,8,1,B,^FS^FO3,149,^GB1,8,1,B,^FS^FO4,125,^GB1,8,1,B,^FS^FO5,133,^GB1,8,1,B,^FS^FO6,141,^GB1,8,1,B,^FS^FO7,149,^GB1,8,1,B,^FS^FD ^PQ1,0,0^XZ

            ",
                },
                Transaction {
                  "awaitedCommands": [
                    CmdHostStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Get host status",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdHostStatus),
                    },
                  ],
                  "commands": "
            ~HS

            ",
                },
              ],
            }
          `);
      });
    });
  });
});
