import { LP2844 } from '../src/LP2844';

test('Initial command buffer is empty', () => {
  expect(new LP2844(null, 0, 0).commandBuffer).toBe('');
});
