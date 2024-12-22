import { expect, describe, it } from 'vitest';
import { ZD410_FULL_SNAPSHOT, ZD410_XML } from './test_files/index.test.js';
import { CmdXmlQuery, parseCmdXmlQuery } from './CmdXmlQuery.js';

describe('parseCmdXmlQueryResponse', () => {
  describe('Full', () => {
    const cmd = new CmdXmlQuery('All');
    it('Extracts the config', async () => {
      const file = ZD410_XML();
      await expect(parseCmdXmlQuery(file, cmd)).toMatchFileSnapshot(ZD410_FULL_SNAPSHOT);
    });
  });
});
