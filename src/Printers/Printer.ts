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
import { PrinterModelDb } from './Models/PrinterModelDb.js';
import { DeviceNotReadyError, type IDeviceChannel, type IDeviceCommunicationOptions, DeviceCommunicationError, type IDeviceInformation, type IDevice, UsbDeviceChannel, InputMessageListener, type IHandlerResponse } from 'web-device-mux';
import { parseRaw, type AwaitedCommand, type IErrorMessage, type IStatusMessage, type MessageArrayLike } from '../Languages/Messages.js';
import { GetStatusCommand, type CommandSet, type CompiledDocument, type Transaction } from '../Documents/index.js';
import * as Lang from '../Languages/index.js';
import { transpileDocument } from '../Documents/DocumentTranspiler.js';
import { hasFlag } from '../EnumUtils.js';

export interface LabelPrinterEventMap {
  //disconnectedDevice: CustomEvent<string>;
  reportedStatus: CustomEvent<IStatusMessage>;
  reportedError: CustomEvent<IErrorMessage>;
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
export class LabelPrinter<TMessageType extends MessageArrayLike> extends EventTarget implements IDevice {
  // Printer communication handles
  private _channel: IDeviceChannel<TMessageType, TMessageType>;
  private _streamListener?: InputMessageListener<TMessageType>;
  private _commandSet?: CommandSet<TMessageType>;

  private _awaitedCommand?: AwaitedCommand;
  private _awaitedCommandTimeoutMS = 5000;

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
  get connected() {
    return !this._disposed
      && this._channel.connected
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

  /** Construct a new printer from a given USB device. */
  static async fromUSBDevice(
    device: USBDevice,
    options: IDeviceCommunicationOptions
  ) {
    const p = new LabelPrinter(new UsbDeviceChannel(device, options), options);
    await p.setup();
    return p;
  }

  /** Construct a new printer from a raw channel object */
  static async fromChannel<TMessageType extends MessageArrayLike>(
    channel: IDeviceChannel<TMessageType, TMessageType>,
    deviceCommunicationOptions: IDeviceCommunicationOptions = { debug: false },
    printerOptions?: PrinterOptions,
  ) {
    const p = new LabelPrinter(channel, deviceCommunicationOptions, printerOptions);
    await p.setup();
    return p;
  }

  protected constructor(
    channel: IDeviceChannel<TMessageType, TMessageType>,
    deviceCommunicationOptions: IDeviceCommunicationOptions = { debug: false },
    printerOptions?: PrinterOptions,
  ) {
    super();
    this._channel = channel;
    this._deviceCommOpts = deviceCommunicationOptions;
    this._printerOptions = printerOptions ?? new PrinterOptions();
  }

  public addEventListener<T extends keyof LabelPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: LabelPrinter<TMessageType>, ev: LabelPrinterEventMap[T]) => void),
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
    listener: EventListenerObject | null | ((this: LabelPrinter<TMessageType>, ev: LabelPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
    super.removeEventListener(type, callback, options);
  }

  private sendEvent(
    eventName: keyof LabelPrinterEventMap,
    detail: IErrorMessage | IStatusMessage
  ): boolean {
    return super.dispatchEvent(new CustomEvent<IErrorMessage | IStatusMessage>(eventName, { detail }));
  }

  private async setup() {
    const channelReady = await this._channel.ready;
    if (!channelReady) {
      // If the channel failed to connect we have no hope.
      await this.dispose();
      return false;
    }

    this._printerOptions.updateDeviceInfo(this._channel.getDeviceInfo());

    this._commandSet = await this.detectLanguage(this._printerOptions);

    this._streamListener = new InputMessageListener<TMessageType>(
      this._channel.getInput.bind(this._channel),
      this.parseAndDispatchMessage.bind(this),
      this._deviceCommOpts.debug,
    );
    this._streamListener.start();

    // Now that we're listening for messages we can query for the full config.
    await this.refreshPrinterConfiguration();

    return true;
  }

  public async dispose() {
    this._disposed = true;
    this._streamListener?.dispose();
    await this._channel.dispose();
  }

  /** Refresh the printer information cache directly from the printer. */
  public async refreshPrinterConfiguration(): Promise<PrinterOptions> {
    // Querying for a config doesn't always.. work? Like, just straight up
    // for reasons I can't figure out some printers will refuse to return
    // a valid config. Mostly EPL models.
    // Give it 3 chances before we give up.
    let retryLimit = 3;
    do {
      retryLimit--;
      try {
        await this.sendDocument(ReadyToPrintDocuments.configDocument);
        return this.printerOptions;
      }
      catch (e) {
        this.logIfDebug(`Error trying to read printer config, trying ${retryLimit} more times.`, e);
      }
    } while (retryLimit > 0);

    throw new DeviceCommunicationError(`Tried ${retryLimit} times to read config and failed.`);
  }

  /** Send a document to the printer, applying the commands. */
  public async sendDocument(
    doc: IDocument,
    commandSet = this._commandSet
  ) {
    if (!this.connected) {
      throw new DeviceNotReadyError("Printer is not ready to communicate.");
    }
    if (commandSet === undefined) {
      throw new DeviceNotReadyError("No command set provided to send, is the printer connected?");
    }

    this.logResultIfDebug(() => 'SENDING DOCUMENT TO PRINTER:\n' + doc.commands.map((c) => c.toDisplay()).join('\n'));

    // Exceptions are thrown and handled elsewhere.
    const state = commandSet.getNewTranspileState(this._printerOptions);
    const compiledDocument = transpileDocument(doc, commandSet, state);

    return this.sendCompiledDocument(compiledDocument);
  }

  /** Send a compiled document to the printer. */
  public async sendCompiledDocument(doc: CompiledDocument<TMessageType>): Promise<boolean> {
    if (this._disposed == true) {
      throw new DeviceNotReadyError("Printer is not ready to communicate.");
    }

    for (const trans of doc.transactions) {
      try {
        const result = await this.sendTransactionAndWait(trans);
        if (!result) { return false; }
      } catch (e) {
        // TODO: Just throw this instead
        if (e instanceof DeviceCommunicationError) {
          console.error(e);
          return false;
        } else {
          throw e;
        }
      }
    }

    return true;
  }

  private async detectLanguage(deviceInfo?: IDeviceInformation): Promise<CommandSet<TMessageType>> {
    const guess = PrinterModelDb.guessLanguageFromModelHint(deviceInfo);
    // Guess order is easiest to detect and support.. to least
    const guessOrder = [
      guess,
      Lang.PrinterCommandLanguage.zpl,
      Lang.PrinterCommandLanguage.epl,
      Lang.PrinterCommandLanguage.cpcl
    ];

    const doc = { commands: [new GetStatusCommand()]} as IDocument
    const awaitedTimeoutOriginal = this._awaitedCommandTimeoutMS;

    // For each language, we send the appropriate command to try and get the
    // config dump. If we get something legible back declare success.
    for (let i = 0; i < guessOrder.length; i++) {
      const set = this.getCommandSetForLanguage(guessOrder[i]);
      if (set === undefined) {
        continue;
      }
      this.logIfDebug('Trying printer language guess', Lang.PrinterCommandLanguage[guessOrder[i]]);

      // Set up a message listener to listen for a response from a status query.
      // We don't actually care about the contents, just that the printer responds
      // to the query we made. Sending a status query will be an awaited command
      // and the message parser will make sure it's a valid response to what we
      // asked. If we time out waiting for the response we move on to the next.
      this._awaitedCommandTimeoutMS = 1000;
      const tmpListener = new InputMessageListener(
        this._channel.getInput.bind(this._channel),
        async (i) => {
          const remainderData = (await parseRaw(i, set, this._awaitedCommand)).remainderData
          return { remainderData }
        },
        this._deviceCommOpts.debug,
      );
      tmpListener.start();

      // Make sure that listener gets disposed.
      try {
        // For reasons I don't fully understand sometimes EPL printers in particular
        // take more than one try to get this right.
        let retryLimit = 3;
        do {
          retryLimit--;
          try {
            await this.sendDocument(doc, set);
            this.logIfDebug('Got response, valid language detected!');
            return set;
          }
          catch (e) {
            if (
              e instanceof DeviceCommunicationError &&
              e.message.startsWith(`Timed out waiting for '${doc.commands[0].name}' response.`)
            ) {
              // Response timeout means we guessed wrong, move on
              this.logIfDebug('Timed out waiting for response, moving onto next guess.');
              continue;
            } else {
              throw e;
            }
          }
        } while (retryLimit > 0);
      }
      finally {
        tmpListener.dispose();
        this._awaitedCommandTimeoutMS = awaitedTimeoutOriginal;
      }
    }

    throw new WebZlpError(
      'Failed to detect the printer information, either the printer is unknown or the config can not be parsed. This printer can not be used.'
    );
  }

  private getCommandSetForLanguage(lang: Lang.PrinterCommandLanguage): CommandSet<TMessageType> | undefined {
    // In order of preferred communication method
    if (hasFlag(lang, Lang.PrinterCommandLanguage.zpl)) {
      return new Lang.ZplPrinterCommandSet();
    }
    if (hasFlag(lang, Lang.PrinterCommandLanguage.epl)) {
      return new Lang.EplPrinterCommandSet();
    }
    return undefined;
  }

  private async sendTransactionAndWait(
    transaction: Transaction<TMessageType>
  ): Promise<boolean> {
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

    // TODO: Still needed??
    //await this._awaitedCommand?.promise;
    if (this._awaitedCommand) {
      this.logIfDebug(`Awaiting response to command '${this._awaitedCommand.cmd.name}'...`);
      await promiseWithTimeout(
        this._awaitedCommand.promise,
        this._awaitedCommandTimeoutMS,
        new DeviceCommunicationError(`Timed out waiting for '${this._awaitedCommand.cmd.name}' response.`)
      );
      this.logIfDebug(`Got a response to command '${this._awaitedCommand.cmd.name}'!`);
    }
    return true;
  }

  private async parseAndDispatchMessage(
    input: TMessageType[]
  ): Promise<IHandlerResponse<TMessageType>> {
    if (this._commandSet === undefined) { return { remainderData: input } }

    if (this._awaitedCommand !== undefined) {
      this.logIfDebug(`Checking if the messages is a response to '${this._awaitedCommand.cmd.name}'.`);
    } else {
      this.logIfDebug(`Not awaiting a command. This message was a surprise, to be sure, but a welcome one.`);
    }

    const parsed = await parseRaw(input, this._commandSet, this._awaitedCommand);

    parsed.messages.forEach(m => {
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

    this.logIfDebug(`Returning unused ${parsed.remainderData.length} bytes.`);
    const remainderData = parsed.remainderData.length === 0 ? [] : [...parsed.remainderData];
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
