import { type IDocument } from '../Documents/Document.js';
import { ConfigDocumentBuilder, type IConfigDocumentBuilder } from '../Documents/ConfigDocument.js';
import {
  type ILabelDocumentBuilder,
  LabelDocumentBuilder,
  LabelDocumentType
} from '../Documents/LabelDocument.js';
import { ReadyToPrintDocuments } from '../Documents/ReadyToPrintDocuments.js';
import { WebZlpError } from '../WebZlpError.js';
import { PrinterOptions } from './Configuration/PrinterOptions.js';
import { EplPrinterCommandSet } from './Languages/EplPrinterCommandSet.js';
import { PrinterCommandSet } from './Languages/PrinterCommandSet.js';
import { ZplPrinterCommandSet } from './Languages/Zpl/index.js';
import { PrinterModelDb } from './Models/PrinterModelDb.js';
import { DeviceNotReadyError, type IDeviceChannel, type IDeviceCommunicationOptions, DeviceCommunicationError, type IDeviceInformation, type IDevice, UsbDeviceChannel, InputMessageListener, type IHandlerResponse } from 'web-device-mux';
import { deviceInfoToOptionsUpdate, type IErrorMessage, type IStatusMessage } from './Messages.js';
import type { IPrinterCommand } from '../Documents/index.js';

export interface LabelPrinterEventMap {
  //disconnectedDevice: CustomEvent<string>;
  reportedStatus: CustomEvent<IStatusMessage>;
  reportedError: CustomEvent<IErrorMessage>;
}

type AwaitedCommand = {
  cmd: IPrinterCommand,
  promise: Promise<boolean>,
  resolve?: (value: boolean) => void,
  reject?: (reason?: unknown) => void,
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error('Promise timed out')
): Promise<T> {
  // create a promise that rejects in milliseconds
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(timeoutError);
    }, ms);
  });

  // returns a race between timeout and the passed promise
  return Promise.race<T>([promise, timeout]);
}

/** A class for working with a label printer. */
export class LabelPrinter extends EventTarget implements IDevice {
  // Printer communication handles
  private _channel: IDeviceChannel<Uint8Array, Uint8Array>;
  private _streamListener?: InputMessageListener<Uint8Array>;
  private _commandSet?: PrinterCommandSet;

  private _awaitedCommand?: AwaitedCommand;

  private _printerOptions: PrinterOptions;
  /** Gets the read-only copy of the current config of the printer. To modify use getConfigDocument. */
  get printerOptions() { return this._printerOptions; }
  /** Gets the model of the printer, detected from the printer's config. */
  get printerModel() { return this._printerOptions.model; }
  /** Gets the manufacturer of the printer, detected from the printer's config. */
  get printerManufacturer() { return this._printerOptions.manufacturer; }
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
    channel: IDeviceChannel<Uint8Array, Uint8Array>,
    deviceCommunicationOptions: IDeviceCommunicationOptions = { debug: false },
    printerOptions?: PrinterOptions,
  ) {
    super();
    this._channel = channel;
    this._deviceCommOpts = deviceCommunicationOptions;
    this._printerOptions = printerOptions ?? new PrinterOptions();
    this._ready = this.setup();

    // Once the printer is set up we should immediately query the printer config.
    this._ready.then((ready) => {
      if (!ready) {
        return;
      }
      return this.sendDocument(ReadyToPrintDocuments.configDocument);
    });
  }

  public addEventListener<T extends keyof LabelPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: LabelPrinter, ev: LabelPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options);
  }

  public removeEventListener<T extends keyof LabelPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: LabelPrinter, ev: LabelPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
      super.removeEventListener(type, callback, options);
  }

  private async setup() {
    const channelReady = await this._channel.ready;
    if (!channelReady) {
      // If the channel failed to connect we have no hope.
      return false;
    }

    this._printerOptions.update(deviceInfoToOptionsUpdate(this._channel.getDeviceInfo()));

    await this.refreshPrinterConfiguration(this._channel.getDeviceInfo());
    return true;
  }

  /** Close the connection to this printer, preventing future communication. */
  public async dispose() {
    this._disposed = true;
    this._ready = Promise.resolve(false);
    this._streamListener?.dispose();
    await this._channel.dispose();
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

  private sendEvent(
    eventName: keyof LabelPrinterEventMap,
    detail: IErrorMessage | IStatusMessage
  ): boolean {
    return super.dispatchEvent(new CustomEvent<IErrorMessage | IStatusMessage>(eventName, { detail }));
  }

  private async sendTransactionAndWait(
    transaction: Transaction<Uint8Array>
  ): Promise<boolean> {
    this.logIfDebug('RAW TRANSACTION: ', asciiToDisplay(...transaction.commands));

    if (transaction.awaitedCommand !== undefined) {
      this.logIfDebug(`Transaction will await a response to '${transaction.awaitedCommand.toDisplay()}'.`);
      let awaitResolve;
      let awaitReject;
      const awaiter: AwaitedCommand = {
        cmd: transaction.awaitedCommand,
        promise: new Promise<boolean>((resolve, reject) => {
          awaitResolve = resolve;
          awaitReject = reject;
        })
      };
      awaiter.reject = awaitReject;
      awaiter.resolve = awaitResolve;
      this._awaitedCommand = awaiter;
    }

    await promiseWithTimeout(
      this._channel.sendCommands(transaction.commands),
      5000,
      new DeviceCommunicationError(`Timed out sending commands to printer, is there a problem with the printer?`)
    );

    // TODO: timeout!
    await this._awaitedCommand?.promise;
    if (this._awaitedCommand) {
      this.logIfDebug(`Awaiting response to command '${this._awaitedCommand.cmd.name}'...`);
      await promiseWithTimeout(
        this._awaitedCommand.promise,
        5000,
        new DeviceCommunicationError(`Timed out waiting for '${this._awaitedCommand.cmd.name}' response.`)
      );
      this.logIfDebug(`Got a response to command '${this._awaitedCommand.cmd.name}'!`);
    }
    return true;
  }

  private async parseMessage(input: Uint8Array[]): Promise<IHandlerResponse<Uint8Array>> {
    if (this._commandSet === undefined) { return { remainderData: input } }
    let msg = this._commandSet.combineCommands(...input);
    if (msg.length === 0) { return {}; }
    let incomplete = false;

    do {
      this.logIfDebug(`Parsing ${msg.length} long message from printer: `, asciiToDisplay(...msg));
      if (this._awaitedCommand !== undefined) {
        this.logIfDebug(`Checking if the messages is a response to '${this._awaitedCommand.cmd.name}'.`);
      } else {
        this.logIfDebug(`Not waiting a command. This message was a surprise, to be sure, but a welcome one.`);
      }

      const parseResult = this._commandSet.parseMessage(msg, this._awaitedCommand?.cmd);
      this.logIfDebug(`Raw parse result: `, parseResult);

      msg = parseResult.remainder;
      incomplete = parseResult.messageIncomplete;

      if (parseResult.messageMatchedExpectedCommand) {
        this.logIfDebug('Received message was expected, marking awaited response resolved.');
        if (this._awaitedCommand?.resolve === undefined) {
          console.error('Resolve callback was undefined for awaited command, this may cause a deadlock! This is a bug in the library.');
        } else {
          this._awaitedCommand.resolve(true);
        }
      }

      parseResult.messages.forEach(m => {
        switch (m.messageType) {
          case 'ErrorMessage':
            this.sendEvent('reportedError', m);
            this.logIfDebug('Error message sent.', m);
            break;
          case 'StatusMessage':
            this.sendEvent('reportedStatus', m);
            this.logIfDebug('Status message sent.', m);
            break;
          case 'SettingUpdateMessage':
            this._printerOptions.update(m);
            this.logIfDebug('Settings update message applied.', m);
            break;
        }
      });

    } while (incomplete === false && msg.length > 0)

    this.logIfDebug(`Returning unused ${msg.length} bytes.`);
    const remainderData = msg.length === 0 ? [] : [msg];
    return { remainderData }
  }

  private logIfDebug(...obj: unknown[]) {
    if (this._deviceCommOpts.debug) {
      console.debug(...obj);
    }
  }

  private logResultIfDebug(fn: () => string) {
    if (this._deviceCommOpts.debug) {
      console.debug(fn());
    }
  }
}
