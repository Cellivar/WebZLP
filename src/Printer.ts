import * as Util from './Util/index.js';
import * as Conf from './Configs/index.js';
import * as Cmds from './Commands/index.js';
import * as Docs from './Documents/index.js';
import * as Lang from './Languages/index.js';
import * as Mux from 'web-device-mux';
import { ReadyToPrintDocuments } from './ReadyToPrintDocuments.js';

export interface LabelPrinterEventMap {
  //disconnectedDevice: CustomEvent<string>;
  reportedStatus: CustomEvent<Cmds.IStatusMessage>;
  reportedError: CustomEvent<Cmds.IErrorMessage>;
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
export class LabelPrinter<TChannelType extends Conf.MessageArrayLike> extends EventTarget implements Mux.IDevice {
  // Printer communication handles
  private _channel: Mux.IDeviceChannel<TChannelType, TChannelType>;
  private _channelType: Conf.MessageArrayLikeType;
  private _channelMessageTransformer: Cmds.MessageTransformer<TChannelType>;
  private _streamListener?: Mux.InputMessageListener<TChannelType>;
  private _commandSet?: Cmds.CommandSet<Conf.MessageArrayLike>;

  private _awaitedCommand?: Cmds.AwaitedCommand;
  private _awaitedCommandTimeoutMS = 5000;

  private _printerOptions: Cmds.PrinterConfig;
  /** Gets the read-only copy of the current config of the printer. To modify use getConfigDocument. */
  get printerOptions() { return this._printerOptions; }
  /** Gets the model of the printer, detected from the printer's config. */
  get printerModel() { return this._printerOptions.model; }
  /** Gets the manufacturer of the printer, detected from the printer's config. */
  get printerManufacturer() { return this._printerOptions.manufacturer; }
  /** Gets the serial number of the printer, detected from the printer's config. */
  get printerSerial() { return this._printerOptions.serialNumber; }

  private _deviceCommOpts: Mux.IDeviceCommunicationOptions;
  /** Gets the configured printer communication options. */
  get printerCommunicationOptions() {
    return this._deviceCommOpts;
  }

  private _disposed = false;
  get connected() {
    return !this._disposed
      && this._channel.connected
  }

  get ready() {
    return this._channel.ready;
  }

  /** Gets a document for configuring this printer. */
  public getConfigDocument(): Docs.IConfigDocumentBuilder {
    return new Docs.ConfigDocumentBuilder(this._printerOptions);
  }

  /** Gets a document for printing a label. */
  public getLabelDocument(
    docType: Docs.LabelDocumentType = Docs.LabelDocumentType.instanceForm
  ): Docs.ILabelDocumentBuilder {
    return new Docs.LabelDocumentBuilder(this._printerOptions, docType);
  }

  /** Construct a new printer from a given USB device. */
  static async fromUSBDevice(
    device: USBDevice,
    options: Mux.IDeviceCommunicationOptions
  ) {
    const p = new LabelPrinter(
      new Mux.UsbDeviceChannel(device, options),
      new Cmds.RawMessageTransformer(),
      'Uint8Array',
      options);
    await p.setup();
    return p;
  }

  /** Construct a new printer from a raw channel object */
  static async fromChannel<TChannelType extends Conf.MessageArrayLike>(
    channel: Mux.IDeviceChannel<TChannelType, TChannelType>,
    channelMessageTransformer: Cmds.MessageTransformer<TChannelType>,
    channelType: Conf.MessageArrayLikeType,
    deviceCommunicationOptions: Mux.IDeviceCommunicationOptions = { debug: false },
    printerOptions?: Cmds.PrinterConfig,
  ) {
    const p = new LabelPrinter(channel, channelMessageTransformer, channelType, deviceCommunicationOptions, printerOptions);
    await p.setup();
    return p;
  }

  protected constructor(
    channel: Mux.IDeviceChannel<TChannelType, TChannelType>,
    channelMessageTransformer: Cmds.MessageTransformer<TChannelType>,
    channelMessageType: Conf.MessageArrayLikeType,
    deviceCommunicationOptions: Mux.IDeviceCommunicationOptions = { debug: false },
    printerOptions?: Cmds.PrinterConfig,
  ) {
    super();
    this._channel = channel;
    this._channelMessageTransformer = channelMessageTransformer;
    this._channelType = channelMessageType;
    this._deviceCommOpts = deviceCommunicationOptions;
    this._printerOptions = printerOptions ?? new Cmds.PrinterConfig();
  }

  public override addEventListener<T extends keyof LabelPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: LabelPrinter<TChannelType>, ev: LabelPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options);
  }

  public override removeEventListener<T extends keyof LabelPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: LabelPrinter<TChannelType>, ev: LabelPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
    super.removeEventListener(type, callback, options);
  }

  private sendEvent(
    eventName: keyof LabelPrinterEventMap,
    detail: Cmds.IErrorMessage | Cmds.IStatusMessage
  ): boolean {
    return super.dispatchEvent(new CustomEvent<Cmds.IErrorMessage | Cmds.IStatusMessage>(eventName, { detail }));
  }

  private async setup() {
    const channelReady = await this._channel.ready;
    if (!channelReady) {
      // If the channel failed to connect we have no hope.
      await this.dispose();
      return false;
    }

    this._printerOptions.update(Cmds.deviceInfoToOptionsUpdate(this._channel.getDeviceInfo()));

    this._commandSet = await this.detectLanguage(this._printerOptions);

    this._streamListener = new Mux.InputMessageListener<TChannelType>(
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
  public async refreshPrinterConfiguration(): Promise<Cmds.PrinterConfig> {
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

    throw new Mux.DeviceCommunicationError(`Tried ${retryLimit} times to read config and failed.`);
  }

  /** Send a document to the printer, applying the commands. */
  public async sendDocument(
    doc: Docs.IDocument,
    commandSet = this._commandSet
  ) {
    if (!this.connected) {
      throw new Mux.DeviceNotReadyError("Printer is not ready to communicate.");
    }
    if (commandSet === undefined) {
      throw new Mux.DeviceNotReadyError("No command set provided to send, is the printer connected?");
    }

    this.logResultIfDebug(() => 'SENDING DOCUMENT TO PRINTER:\n' + doc.commands.map((c) => c.toDisplay()).join('\n'));

    // Exceptions are thrown and handled elsewhere.
    const state = Cmds.getNewTranspileState(this._printerOptions);
    const compiledDocument = Docs.transpileDocument(doc, commandSet, state);

    return this.sendCompiledDocument(compiledDocument);
  }

  /** Send a compiled document to the printer. */
  public async sendCompiledDocument(doc: Docs.CompiledDocument): Promise<boolean> {
    if (this._disposed == true) {
      throw new Mux.DeviceNotReadyError("Printer is not ready to communicate.");
    }

    for (const trans of doc.transactions) {
      try {
        const result = await this.sendTransactionAndWait(trans);
        if (!result) { return false; }
      } catch (e) {
        // TODO: Just throw this instead
        if (e instanceof Mux.DeviceCommunicationError) {
          console.error(e);
          return false;
        } else {
          throw e;
        }
      }
    }

    return true;
  }

  private async detectLanguage(deviceInfo?: Mux.IDeviceInformation): Promise<Cmds.CommandSet<Conf.MessageArrayLike>> {
    const guess = Lang.guessLanguageFromModelHint(deviceInfo);
    const guessOrder = [
      guess,
      // EPL printers are more fragile than ZPL, try them first if we're guessing
      Conf.PrinterCommandLanguage.epl,
      Conf.PrinterCommandLanguage.zpl,
      Conf.PrinterCommandLanguage.cpcl
    ];

    const doc = { commands: [new Cmds.GetStatusCommand()]} as Docs.IDocument
    const awaitedTimeoutOriginal = this._awaitedCommandTimeoutMS;

    // For each language, we send the appropriate command to try and get the
    // config dump. If we get something legible back declare success.
    for (let i = 0; i < guessOrder.length; i++) {
      const set = Lang.getCommandSetForLanguage(guessOrder[i]);
      if (set === undefined) {
        continue;
      }
      this.logIfDebug('Trying printer language guess', Conf.PrinterCommandLanguage[guessOrder[i]]);

      // Set up a message listener to listen for a response from a status query.
      // We don't actually care about the contents, just that the printer responds
      // to the query we made. Sending a status query will be an awaited command
      // and the message parser will make sure it's a valid response to what we
      // asked. If we time out waiting for the response we move on to the next.
      this._awaitedCommandTimeoutMS = 1000;
      const tmpListener = new Mux.InputMessageListener(
        this._channel.getInput.bind(this._channel),
        async (i) => {
          const msg = this._channelMessageTransformer.combineMessages(...i);
          const remainderData = (await Cmds.parseRaw(msg, set, this._awaitedCommand)).remainderData
          return { remainderData: [remainderData] }
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
              e instanceof Mux.DeviceCommunicationError &&
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

    throw new Util.WebZlpError(
      'Failed to detect the printer information, either the printer is unknown or the config can not be parsed. This printer can not be used.'
    );
  }

  private async sendTransactionAndWait(
    transaction: Docs.Transaction
  ): Promise<boolean> {
    if (transaction.awaitedCommand !== undefined) {
      this.logIfDebug(`Transaction will await a response to '${transaction.awaitedCommand.toDisplay()}'.`);
      let awaitResolve;
      let awaitReject;
      const awaiter: Cmds.AwaitedCommand = {
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

    // TODO: Better type guards??
    let sendCmds: TChannelType;
    switch(this._channelType) {
      default:
        Util.exhaustiveMatchGuard(this._channelType);
        break;
      case 'Uint8Array':
        sendCmds = Cmds.asUint8Array(transaction.commands) as TChannelType;
        break;
      case 'string':
        sendCmds = Cmds.asString(transaction.commands) as TChannelType;
        break;
    }

    await promiseWithTimeout(
      this._channel.sendCommands(sendCmds),
      5000,
      new Mux.DeviceCommunicationError(`Timed out sending commands to printer, is there a problem with the printer?`)
    );

    // TODO: Still needed??
    //await this._awaitedCommand?.promise;
    if (this._awaitedCommand) {
      this.logIfDebug(`Awaiting response to command '${this._awaitedCommand.cmd.name}'...`);
      await promiseWithTimeout(
        this._awaitedCommand.promise,
        this._awaitedCommandTimeoutMS,
        new Mux.DeviceCommunicationError(`Timed out waiting for '${this._awaitedCommand.cmd.name}' response.`)
      );
      this.logIfDebug(`Got a response to command '${this._awaitedCommand.cmd.name}'!`);
    }
    return true;
  }

  private async parseAndDispatchMessage(
    input: TChannelType[]
  ): Promise<Mux.IHandlerResponse<TChannelType>> {
    if (this._commandSet === undefined) { return { remainderData: input } }

    if (this._awaitedCommand !== undefined) {
      this.logIfDebug(`Checking if the messages is a response to '${this._awaitedCommand.cmd.name}'.`);
    } else {
      this.logIfDebug(`Not awaiting a command. This message was a surprise, to be sure, but a welcome one.`);
    }

    const msg = this._channelMessageTransformer.combineMessages(...input);
    const parsed = await Cmds.parseRaw(msg, this._commandSet, this._awaitedCommand);

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
    const remainderData = parsed.remainderData.length === 0 ? [] : [parsed.remainderData];
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
