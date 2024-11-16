import { WebZlpError } from '../../WebZlpError.js';
import { ConnectionDirectionMode, DeviceCommunicationError, DeviceNotReadyError, type IDeviceChannel, type IDeviceCommunicationOptions, type IDeviceInformation } from './DeviceCommunication.js';
import { LineBreakTransformer } from './LineBreakTransformer.js';

export interface IUSBDeviceInformation extends IDeviceInformation {
  readonly deviceClass: number;
  readonly deviceSubclass: number;
  readonly deviceProtocol: number;
  readonly vendorId: number;
  readonly productId: number;
  readonly deviceVersionMajor: number;
  readonly deviceVersionMinor: number;
  readonly deviceVersionSubminor: number;
}

function deviceToInfo(device: USBDevice): IUSBDeviceInformation {
  return {
    deviceClass: device.deviceClass,
    deviceProtocol: device.deviceProtocol,
    deviceSubclass: device.deviceSubclass,
    deviceVersionMajor: device.deviceVersionMajor,
    deviceVersionMinor: device.deviceVersionMinor,
    deviceVersionSubminor: device.deviceVersionSubminor,
    productId: device.productId,
    vendorId: device.vendorId,
    manufacturerName: device.manufacturerName,
    productName: device.productName,
    serialNumber: device.serialNumber,
  };
}

/** Class for managing the WebUSB communication with a printer. */
export class UsbDeviceChannel implements IDeviceChannel<Uint8Array, string> {
  private device: USBDevice;
  private deviceIn?: USBEndpoint;
  private deviceOut?: USBEndpoint;

  private _commOptions: IDeviceCommunicationOptions;

  public readonly channelType = "USB" as const;

  private _commMode = ConnectionDirectionMode.none;
  public get commMode() { return this._commMode; }

  private _readyFlag = false;
  private _readyPromise: Promise<boolean>;
  public get ready() { return this._readyPromise; }
  public get connected() {
    return !this._disposed
      && this._readyFlag
      && this.device.opened
  }

  private _disposed = false;

  private _inputStream?: ReadableStream<string>;

  constructor(
    device: USBDevice,
    commOptions: IDeviceCommunicationOptions = { debug: false }
  ) {
    this.device = device;
    this._commOptions = commOptions;
    this._readyPromise = this.setup();
  }

  private async setup() {
    try {
      await this.connect();
    } catch {
      await this.dispose();
    }
    this._readyFlag = true;
    return true;
  }

  public async dispose() {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._readyPromise = Promise.resolve(false);
    try {
      await this.device.close();
    } catch (e) {
      if (
        e instanceof DOMException &&
        e.name === 'NotFoundError' &&
        e.message ===
        "Failed to execute 'close' on 'USBDevice': The device was disconnected."
      ) {
        // Device was already closed, no-op.
        return;
      }

      throw e;
    }
  }

  public async sendCommands(
    commandBuffer: Uint8Array
  ): Promise<DeviceCommunicationError | undefined> {
    if (this.deviceOut === undefined || !this.connected) {
      return new DeviceNotReadyError();
    }

    if (this._commOptions.debug) {
      console.debug('Sending command buffer to device via USB.');
      console.time('commandBufferSendTime');
    }

    try {
      // TOOD: Add timeout in case of communication hang.
      await this.device.transferOut(this.deviceOut.endpointNumber, commandBuffer);
      return;
    } catch (e: unknown) {
      if (typeof e === 'string') {
        return new DeviceCommunicationError(e);
      }
      if (e instanceof Error) {
        return new DeviceCommunicationError(undefined, e);
      }
      // Dunno what this is but we can't wrap it.
      throw e;
    } finally {
      if (this._commOptions.debug) {
        console.timeEnd('commandBufferSendTime');
        console.debug('Completed sending commands.');
      }
    }
  }

  private async connect() {
    const d = this.device;

    // Most devices have two endpoints on one interface for bidirectional bulk
    // in and out. The more poorly performing a device the more random this
    // layout will be, so we must go and look for these two endpoints.
    if (d.configurations[0]?.interfaces[0]?.alternates[0] === undefined) {
      // Can't talk to the device at all???
      throw new DeviceCommunicationError(
        'USB device did not expose an endpoint to communicate with. Try power-cycling the device, or checking its settings. This is a hardware problem.'
      );
    }

    // Open the connections! Stop having it be closed!
    try {
      await d.open();
    } catch (e) {
      if (
        e instanceof DOMException &&
        e.name === 'SecurityError' &&
        e.message === "Failed to execute 'open' on 'USBDevice': Access denied."
      ) {
        // This can happen if something else, usually the operating system, has taken
        // exclusive access of the USB device and won't allow WebUSB to take control.
        // This most often happens on Windows. You can use Zadig to replace the driver.
        throw new DriverAccessDeniedError();
      }

      throw e;
    }

    await d.selectConfiguration(1);
    await d.claimInterface(0);

    // A standard Zebra printer will have two endpoints on one interface.
    // One of them will be output, one of them will be input. They can be
    // in a random order (or missing!) so we must enumerate them to find them.
    let o: USBEndpoint | undefined = undefined;
    let i: USBEndpoint | undefined = undefined;
    for (const endpoint of d.configurations[0].interfaces[0].alternates[0].endpoints) {
      if (endpoint.direction == 'out') {
        o = endpoint;
      } else if (endpoint.direction == 'in') {
        i = endpoint;
      }
    }

    // For no apparent reason sometimes printers will omit to advertise the
    // input endpoint. Sometimes they'll also omit the output endpoint. This
    // attempts to handle those situations in a degraded mode.
    if (!o) {
      throw new WebZlpError(
        'USB printer did not expose an output endpoint. Try power-cycling the printer. This is a hardware problem.'
      );
    } else {
      this.deviceOut = o;
    }

    if (!i) {
      console.warn('USB printer did not expose an input endpoint, using unidirectinal mode.');
    } else {
      this.deviceIn = i;
    }

    this._commMode = this.getCommMode(this.deviceOut !== undefined, this.deviceIn !== undefined);
    if (this._commMode === ConnectionDirectionMode.none) {
      // Can't talk to the printer so don't try.
      return;
    }

    if (this._commOptions.debug) {
      console.debug('Comm mode with printer is', ConnectionDirectionMode[this._commMode]);
    }

    // Can only read if there's an endpoint to read from, otherwise skip.
    if (this._commMode === ConnectionDirectionMode.bidirectional) {
      this._inputStream = new ReadableStream<Uint8Array>({
        pull: async (controller) => {
          if (this.deviceIn === undefined || !this.device.opened) {
            return undefined;
          }
          const result = await this.device.transferIn(this.deviceIn.endpointNumber, 64);
          if (result.data !== undefined) {
            const chunk = new Uint8Array(
              result.data.buffer,
              result.data.byteOffset,
              result.data.byteLength
            );
            controller.enqueue(chunk);
          }
        }
      })
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TransformStream(new LineBreakTransformer()));
    }
  }

  public getDeviceInfo() {
    return deviceToInfo(this.device);
  }

  public async getInput(): Promise<string[] | DeviceNotReadyError> {
    if (!this.connected || this.deviceIn === undefined) {
      return new DeviceNotReadyError('Channel is not connected.');
    }

    let aggregate = '';
    for (; ;) {
      const line = await this.nextLine(this._commOptions.messageWaitTimeoutMS ?? 500);
      if (line === undefined) {
        this.logIfDebug(`Received ${aggregate.length} long message from printer:\n`, aggregate);
        return [aggregate];
      }
      aggregate += line + '\n';
    }
  }

  /** Wait for the next line of data sent from the printer, or an empty string if nothing is received. */
  private async nextLine(timeoutMs: number): Promise<string | void> {
    if (this._inputStream === undefined) { return; }
    let reader: ReadableStreamDefaultReader<string>;
    const nextLinePromise = (async () => {
      if (this._inputStream === undefined) { return; }

      reader = this._inputStream.getReader();
      const { value, done } = await reader.read();
      reader.releaseLock();

      if (done) {
        return;
      }

      return value;
    })();

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        reader.releaseLock();
        resolve();
      }, timeoutMs);
    });

    return Promise.race([nextLinePromise, timeoutPromise]);
  }

  private getCommMode(output: boolean, input: boolean) {
    // TODO: Figure out if getting the Interface Protocol Mode is more
    // reliable than the detection method used here...
    if (output === false) {
      // Can't talk to something that isn't listening...
      return ConnectionDirectionMode.none;
    }
    if (input === false) {
      // Can send commands but can't get info back. Operating in the blind.
      return ConnectionDirectionMode.unidirectional;
    }
    return ConnectionDirectionMode.bidirectional;
  }

  private logIfDebug(...obj: unknown[]) {
    if (this._commOptions.debug) {
      console.debug(...obj);
    }
  }
}

/** Error indicating the printer's driver cannot be used by WebUSB. */
export class DriverAccessDeniedError extends WebZlpError {
  constructor() {
    super(
      'Operating system prevented accessing the USB device. If this is on Windows you may need to replace the driver. See https://cellivar.github.io/WebZLP/docs/windows_driver for more details.'
    );
  }
}
