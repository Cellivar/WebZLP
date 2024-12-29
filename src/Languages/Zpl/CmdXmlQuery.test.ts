import { expect, describe, it } from 'vitest';
import { ZD410_FULL_SNAPSHOT, ZD410_CONF_REMAINDER, ZD410_TXT, ZD410_XML } from './test_files/index.test.js';
import { CmdXmlQuery, parseCmdXmlQuery } from './CmdXmlQuery.js';

describe('parseCmdXmlQueryResponse', () => {
  describe('Full', () => {
    const cmd = new CmdXmlQuery('All');
    it('Extracts the config', async () => {
      const file = ZD410_XML();
      await expect(parseCmdXmlQuery(file, cmd)).toMatchFileSnapshot(ZD410_FULL_SNAPSHOT);
    });
  });

  describe('Partials', () => {
    const cmd = new CmdXmlQuery('All');
    it('Handles extra content at the end of the document', async () => {
      const xml = ZD410_XML();
      const conf = ZD410_TXT();
      const prefix = `${conf}${xml}`;
      const postfix = `${xml}${conf}`;
      await (expect(parseCmdXmlQuery(postfix, cmd))).toMatchFileSnapshot(ZD410_CONF_REMAINDER);
      await (expect(parseCmdXmlQuery(prefix, cmd))).toMatchFileSnapshot(ZD410_CONF_REMAINDER);
    });
  });
});
