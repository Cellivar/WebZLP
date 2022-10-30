import { PrinterCommunicationMode } from '../src/Printers/Communication/PrinterCommunication';

test('Neither endpoint available returns none mode', () => {
  const mode = PrinterCommunicationMode.getCommunicationMode(undefined, undefined);
  expect(mode).toBe(PrinterCommunicationMode.none);
});

test('Output only returns unidirectional', () => {
  const mode = PrinterCommunicationMode.getCommunicationMode(true, undefined);
  expect(mode).toBe(PrinterCommunicationMode.unidirectional);
});

test('Both endpoint returns bidirectional', () => {
  const mode = PrinterCommunicationMode.getCommunicationMode(true, true);
  expect(mode).toBe(PrinterCommunicationMode.bidirectional);
});
