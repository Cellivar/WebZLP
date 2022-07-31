import { PrinterCommunicationMode } from "../src/PrinterCommunicationMode";

test('Neither endpoint available returns none mode', () => {
    const mode = PrinterCommunicationMode.getCommunicationMode(undefined, undefined);
    expect(mode).toBe(PrinterCommunicationMode.None);
});

test('Output only returns unidirectional', () => {
    const mode = PrinterCommunicationMode.getCommunicationMode(true, undefined);
    expect(mode).toBe(PrinterCommunicationMode.Unidirectional);
});

test('Both endpoint returns bidirectional', () => {
    const mode = PrinterCommunicationMode.getCommunicationMode(true, true);
    expect(mode).toBe(PrinterCommunicationMode.Bidirectional);
});