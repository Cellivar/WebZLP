import { expect, describe, it } from 'vitest';
import { promiseWithTimeout } from './PromiseUtils.js';


describe('promiseWithtimeout', () => {
  it('Completes a promise before a timeout', async () => {
    const complete = Promise.resolve(true);
    const out = await promiseWithTimeout(complete, 100);
    expect(out).toBe(await complete);
  })
});
