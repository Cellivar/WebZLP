import { expect, describe, it } from 'vitest';
import { BasePrinterConfig } from './BasePrinterConfig.js';

class TestPrinterConfig extends BasePrinterConfig {
  public test_dotToInch(dots?: number) { return this.dotToInch(dots) ;}
}

describe('BasePrinterConfig', () => {
  it('Converts dots to inches', () => {
    // Default DPI of 203
    const conf = new TestPrinterConfig();
    expect(conf.test_dotToInch(203)).toBe(1);
  });
});
 