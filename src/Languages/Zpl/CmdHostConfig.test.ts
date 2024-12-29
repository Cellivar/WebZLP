import { expect, describe, it } from 'vitest';
import { ZD410_TXT } from './test_files/index.test.js';
import { CmdHostConfig, parseCmdHostConfig } from './CmdHostConfig.js';

describe('parseCmdHostConfig', () => {
  describe('Full', () => {
    const cmd = new CmdHostConfig();
    it('Extracts the config', () => {
      const file = ZD410_TXT();
      expect(parseCmdHostConfig(file, cmd)).toMatchInlineSnapshot(`
        {
          "messageIncomplete": false,
          "messageMatchedExpectedCommand": true,
          "messages": [
            {
              "messageType": "SettingUpdateMessage",
              "printerHardware": {},
              "printerMedia": {
                "mediaGapDetectMode": 1,
              },
              "printerSettings": {},
            },
          ],
          "remainder": "",
        }
      `);
    });
  })
});
