import { expect, describe, it } from 'vitest';
import * as tf from './test_files/index.test.js';
import { CmdXmlQuery, parseCmdXmlQuery } from './CmdXmlQuery.js';

describe('parseCmdXmlQueryResponse', () => {
  describe('Full config extract', () => {
    const cmd = new CmdXmlQuery('All');
    it('ZD410', async () => {
      await expect(parseCmdXmlQuery(tf.ZD410_XML(), cmd)).toMatchFileSnapshot(tf.ZD410_FULL);
    });
    it('ZD411', async () => {
      await expect(parseCmdXmlQuery(tf.ZD411_XML(), cmd)).toMatchFileSnapshot(tf.ZD411_FULL);
    });
    it('ZP505', async () => {
      await expect(parseCmdXmlQuery(tf.ZP505_XML(), cmd)).toMatchFileSnapshot(tf.ZP505_FULL);
    });
    it('R2844_Z', async () => {
      await expect(parseCmdXmlQuery(tf.R2844_Z_XML(), cmd)).toMatchFileSnapshot(tf.R2844_Z_FULL);
    });
    it('LP2844_Z', async () => {
      await expect(parseCmdXmlQuery(tf.LP2844_Z_XML(), cmd)).toMatchFileSnapshot(tf.LP2844_Z_FULL);
    });
    it('TLP2844_Z', async () => {
      await expect(parseCmdXmlQuery(tf.TLP2844_Z_XML(), cmd)).toMatchFileSnapshot(tf.TLP2844_Z_FULL);
    });
  });

  describe('Partials', () => {
    const cmd = new CmdXmlQuery('All');
    it('Handles extra content at the end of the document', async () => {
      const xml = tf.ZD410_XML();
      const conf = tf.ZD410_TXT();
      const prefix = `${conf}${xml}`;
      const postfix = `${xml}${conf}`;
      await (expect(parseCmdXmlQuery(postfix, cmd))).toMatchFileSnapshot(tf.ZD410_CONF_REMAINDER);
      await (expect(parseCmdXmlQuery(prefix, cmd))).toMatchFileSnapshot(tf.ZD410_CONF_REMAINDER);
    });
  });
});
