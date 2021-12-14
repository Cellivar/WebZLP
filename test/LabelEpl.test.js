import { LabelEpl } from '../src/LabelEpl'

test('Command buffer starts with \\nN\\n', () => {
    expect(new LabelEpl(0, 0, 0, 0).commandBuffer).toBe("\nN\n");
});

test('End Label Command Adds Single Print', () => {
    expect(new LabelEpl(0, 0, 0, 0).end().commandBuffer).toBe("\nN\nP1\n");
});

test('End label Command Adds Multiple Print', () => {
    expect(new LabelEpl(0, 0, 0, 0).end(5).commandBuffer).toBe("\nN\nP5\n");
});

test('End label Command Negative Becomes 1', () => {
    expect(new LabelEpl(0, 0, 0, 0).end(-5).commandBuffer).toBe("\nN\nP1\n");
});

