import { type IDocument } from '../Documents/Document.js';
import { ConfigDocumentBuilder, type IConfigDocumentBuilder } from '../Documents/ConfigDocument.js';
import {
  type ILabelDocumentBuilder,
  LabelDocumentBuilder,
  LabelDocumentType
} from '../Documents/LabelDocument.js';
import { ReadyToPrintDocuments } from '../Documents/ReadyToPrintDocuments.js';
import { WebZlpError } from '../WebZlpError.js';
import { UsbDeviceChannel } from './Communication/UsbPrinterDeviceChannel.js';
import { PrinterCommandLanguage, PrinterOptions } from './Configuration/PrinterOptions.js';
import { EplPrinterCommandSet } from './Languages/EplPrinterCommandSet.js';
import { PrinterCommandSet } from './Languages/PrinterCommandSet.js';
import { ZplPrinterCommandSet } from './Languages/ZplPrinterCommandSet.js';
import { PrinterModelDb } from './Models/PrinterModelDb.js';
import { DeviceNotReadyError, type IDeviceChannel, type IDeviceCommunicationOptions, DeviceCommunicationError, type IDeviceInformation, type IDevice } from './Communication/DeviceCommunication.js';

/**
 * A class for working with a label printer.
 */
export class LabelPrinter implements IDevice {
  // Printer communication handles
  private _channel: IDeviceChannel<Uint8Array, string>;
  private _commandSet?: PrinterCommandSet;

  private _printerOptions: PrinterOptions;
  /** Gets the read-only copy of the current config of the printer. To modify use getConfigDocument. */
  get printerOptions() { return this._printerOptions.copy(); }
  /** Gets the model of the printer, detected from the printer's config. */
  get printerModel() { return this._printerOptions.model; }
  /** Gets the serial number of the printer, detected from the printer's config. */
  get printerSerial() { return this._printerOptions.serialNumber; }

  private _deviceCommOpts: IDeviceCommunicationOptions;
  /** Gets the configured printer communication options. */
  get printerCommunicationOptions() {
    return this._deviceCommOpts;
  }

  private _disposed = false;
  private _ready: Promise<boolean>;
  /** A promise indicating this printer is ready to be used. */
  get ready() {
    return this._ready;
  }
  get connected() {
    return !this._disposed
      && this._channel.connected
  }

  /** Construct a new printer from a given USB device. */
  static fromUSBDevice(
    device: USBDevice,
    options: IDeviceCommunicationOptions
  ): LabelPrinter {
    return new LabelPrinter(new UsbDeviceChannel(device, options), options);
  }

  constructor(
    channel: IDeviceChannel<Uint8Array, string>,
    deviceCommunicationOptions: IDeviceCommunicationOptions = { debug: false },
    printerOptions?: PrinterOptions,
  ) {
    this._channel = channel;
    this._deviceCommOpts = deviceCommunicationOptions;
    this._printerOptions = printerOptions ?? PrinterOptions.invalid;
    this._ready = this.setup();
  }

  private async setup() {
    const channelReady = await this._channel.ready;
    if (!channelReady) {
      // If the channel failed to connect we have no hope.
      return false;
    }

    await this.refreshPrinterConfiguration(this._channel.getDeviceInfo());
    return true;
  }

  /** Gets a document for configuring this printer. */
  public getConfigDocument(): IConfigDocumentBuilder {
    return new ConfigDocumentBuilder(this._printerOptions);
  }

  /** Gets a document for printing a label. */
  public getLabelDocument(
    docType: LabelDocumentType = LabelDocumentType.instanceForm
  ): ILabelDocumentBuilder {
    return new LabelDocumentBuilder(this._printerOptions, docType);
  }

  /** Send a document to the printer, applying the commands. */
  public async sendDocument(doc: IDocument) {
    await this.ready;
    if (!this.connected || this._commandSet === undefined) {
      throw new DeviceNotReadyError("Printer is not ready to communicate.");
    }

    if (this._deviceCommOpts.debug) {
      console.debug('SENDING COMMANDS TO PRINTER:');
      console.debug(doc.showCommands());
    }

    // Exceptions are thrown and handled elsewhere.
    const compiled = this._commandSet.transpileDoc(doc);

    if (this._deviceCommOpts.debug) {
      console.debug('RAW COMMAND BUFFER:');
      console.debug(compiled.commandBufferString);
    }

    await this._channel.sendCommands(compiled.commandBuffer);
  }

  /** Close the connection to this printer, preventing future communication. */
  public async dispose() {
    this._disposed = true;
    this._ready = Promise.resolve(false);
    await this._channel.dispose();
  }

  /** Refresh the printer information cache directly from the printer. */
  public async refreshPrinterConfiguration(deviceInfo?: IDeviceInformation): Promise<PrinterOptions> {
    if (!this._printerOptions.valid) {
      // First time pulling the config. Detect language and model.
      this._printerOptions = await this.detectLanguageAndSetConfig(deviceInfo);
    } else {
      this._printerOptions = await this.tryGetConfig(this._commandSet);
    }

    if (!this._printerOptions.valid) {
      throw new WebZlpError(
        'Failed to detect the printer information, either the printer is unknown or the config can not be parsed. This printer can not be used.'
      );
    }
    return this._printerOptions;
  }

  private async detectLanguageAndSetConfig(deviceInfo?: IDeviceInformation): Promise<PrinterOptions> {
    const guess = PrinterModelDb.guessLanguageFromModelHint(deviceInfo);
    // Guess order is easiest to detect and support.. to least
    const guessOrder = [
      guess,
      PrinterCommandLanguage.epl,
      PrinterCommandLanguage.zpl,
      PrinterCommandLanguage.cpcl
    ];

    // For each language, we send the appropriate command to try and get the
    // config dump. If we get something legible back break out.
    for (let i = 0; i < guessOrder.length; i++) {
      const set = this.getCommandSetForLanguage(guessOrder[i]);
      if (set === undefined) {
        continue;
      }
      this.logIfDebug('Trying printer language guess', PrinterCommandLanguage[guessOrder[i]]);
      const config = await this.tryGetConfig(set);
      if (config.valid) {
        this._commandSet = set;
        return config;
      }
    }

    return { valid: false } as PrinterOptions;
  }

  private getCommandSetForLanguage(lang: PrinterCommandLanguage): PrinterCommandSet | undefined {
    // In order of preferred communication method
    if (PrinterCommandLanguage.zpl === (lang & PrinterCommandLanguage.zpl)) {
      return new ZplPrinterCommandSet();
    }
    if (PrinterCommandLanguage.epl === (lang & PrinterCommandLanguage.epl)) {
      return new EplPrinterCommandSet();
    }
    return undefined;
  }

  private async tryGetConfig(cmdSet?: PrinterCommandSet): Promise<PrinterOptions> {
    let config = PrinterOptions.invalid;
    if (cmdSet === undefined) { return config; }

    const compiled = cmdSet.transpileDoc(ReadyToPrintDocuments.configDocument);
    this.logIfDebug('Querying printer config with', compiled.commandBufferString);

    // Querying for a config doesn't always.. work? Like, just straight up
    // for reasons I can't figure out some printers will refuse to return
    // a valid config. Mostly EPL models.
    // Give it 3 chances before we give up.
    let retryLimit = 3;
    do {
      retryLimit--;

      // Start listening for the return from the printer
      const awaitInput = this._channel.getInput(); // this.listenForData();

      // Config isn't set up yet, send command directly without the send command.
      await this._channel.sendCommands(compiled.commandBuffer);
      const rawResult = await awaitInput;
      if (rawResult instanceof DeviceCommunicationError) {
        continue;
      }
      config = cmdSet.parseConfigurationResponse(
        rawResult.join(),
        this._printerOptions
      );
    } while (!config.valid && retryLimit > 0);

    this.logIfDebug(`Config result is ${config.valid ? 'valid' : 'not valid.'}`);

    return config;
  }

  private logIfDebug(...obj: unknown[]) {
    if (this._deviceCommOpts.debug) {
      console.debug(...obj);
    }
  }
}
