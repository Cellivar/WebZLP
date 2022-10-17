import { LabelEpl } from '../src/LabelEpl';

test('Command buffer starts with \\nN\\n', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).commandBuffer).toBe('\nN\n');
});

test('Clearing command buffer starts with \\nN\\n', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).clearCommandBuffer().commandBuffer).toBe('\nN\n');
});

test('End Label Command Adds Single Print', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).end().commandBuffer).toBe('\nN\nP1\n');
});

test('End label Command Adds Multiple Print', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).end(5).commandBuffer).toBe('\nN\nP5\n');
});

test('End label Command Negative Becomes 1', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).end(-5).commandBuffer).toBe('\nN\nP1\n');
});

test('Setting line spacing sets line spacing', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).setLineSpacing(4).lineSpacing).toBe(4);
});

test('Setting font size sets font size', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).setFont(4).font).toBe(4);
});

test('Setting default font size sets font size', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).setFont().font).toBe(1);
});

test('Setting font size out of bounds sets font size', () => {
  expect(new LabelEpl(0, 0, 0, 0, 0).setFont(-1).font).toBe(1);
});

test('Setting and clearing offsets works', () => {
  const label = new LabelEpl(0, 0, 0, 0, 0);
  expect(label.horizontalOffset).toBe(0);
  expect(label.verticalOffset).toBe(0);

  const initialOffset = 5;
  label.setOffset(initialOffset, initialOffset);
  expect(label.horizontalOffset).toBe(initialOffset);
  expect(label.verticalOffset).toBe(initialOffset);

  label.clearOffsets();
  expect(label.horizontalOffset).toBe(0);
  expect(label.verticalOffset).toBe(0);

  label.setOffset(initialOffset);
  expect(label.horizontalOffset).toBe(initialOffset);
  expect(label.verticalOffset).toBe(0);

  label.setOffset(5.5, 5.5);
  expect(label.horizontalOffset).toBe(initialOffset);
  expect(label.verticalOffset).toBe(initialOffset);
});

test('Adding text adds text command to buffer', () => {
  const label = new LabelEpl(203, 203, 203, 0, 0);
  const testText = 'hello world';
  label.setFont(1).addText(testText);
  expect(label.commandBuffer).toBe(`\nN\nA0,0,0,1,1,1,N,"${testText}"\n`);
  expect(label.font).toBe(1);
  expect(label.verticalOffset).toBe(label.fontSizes[label.font]['y']);
});

test('Adding text adds text command to buffer', () => {
  const label = new LabelEpl(203, 203, 203, 0, 0);
  label.setFont(1).addText();
  expect(label.commandBuffer).toBe(`\nN\nA0,0,0,1,1,1,N,""\n`);
  label.clearCommandBuffer().clearOffsets();
  label.addText('', 2);
  expect(label.commandBuffer).toBe(`\nN\nA0,0,0,1,2,2,N,""\n`);
});

test('Adding text with font 5 uppercases text in command buffer', () => {
  const label = new LabelEpl(203, 203, 203, 0, 0);
  const testText = 'hello world';
  label.setFont(5).addText(testText);
  expect(label.commandBuffer).toBe(`\nN\nA0,0,0,5,1,1,N,"${testText.toUpperCase()}"\n`);
  expect(label.font).toBe(5);
  expect(label.verticalOffset).toBe(label.fontSizes[label.font]['y']);
});
