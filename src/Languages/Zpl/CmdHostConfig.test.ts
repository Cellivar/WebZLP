import { expect, describe, it } from 'vitest';
import * as tf from './test_files/index.test.js';
import { CmdHostConfig, parseCmdHostConfig } from './CmdHostConfig.js';

describe('parseCmdHostConfig', () => {
  const cmd = new CmdHostConfig();

  describe("ZD410", () => {
    const conf = tf.ZD410_TXT();
    const snap = tf.ZD410_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("ZD411", () => {
    const conf = tf.ZD411_TXT();
    const snap = tf.ZD411_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("ZP505", () => {
    const conf = tf.ZP505_TXT();
    const snap = tf.ZP505_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("LP2844-Z", () => {
    const conf = tf.LP2844_Z_TXT();
    const snap = tf.LP2844_Z_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("LP2844-Z-NET", () => {
    const conf = tf.LP2844_Z_NET_TXT();
    const snap = tf.LP2844_Z_NET_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("TLP2844-Z", () => {
    const conf = tf.TLP2844_Z_TXT();
    const snap = tf.TLP2844_Z_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("R2844-Z", () => {
    const conf = tf.R2844_Z_TXT();
    const snap = tf.R2844_Z_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });

  describe("LP2824PLUS", () => {
    const conf = tf.LP2824PLUS_TXT();
    const snap = tf.LP2824PLUS_CONF;
    it('Parses host config', () => {
      expect(parseCmdHostConfig(conf, cmd)).toMatchFileSnapshot(snap);
    });
  });
});
