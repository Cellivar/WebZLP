import type { IDevice, IDeviceCommunicationOptions, IDeviceEvent } from './Printers/Communication/DeviceCommunication.js';

export interface IUsbDeviceManagerEventMap<TDevice extends IDevice> {
  connectedDevice: CustomEvent<IDeviceEvent<TDevice>>;
  disconnectedDevice: CustomEvent<IDeviceEvent<TDevice>>;
}

export interface IUsbDeviceCommunicationOptions extends IDeviceCommunicationOptions {
  /** Connection options for what types of USB devices to pay attention to. */
  requestOptions: USBDeviceRequestOptions;
}

type DeviceGetter<TDevice extends IDevice> = (
  device: USBDevice,
  deviceCommunicationOptions: IUsbDeviceCommunicationOptions
) => TDevice;

/** Singleton for handling USB device management.
 *
 * This class can be used to handle the WebUSB communication management for you instead of handling
 * device connections yourself. The promptToConnect method is used to prompt the user to select
 * a device using the browser's UI. Once paired at least once the browser will remember and reconnect
 * automatically.
 *
 * This class exposes events, which your code should add handlers for:
 * * connectedDevice: Fired when a device is ready to be interacted with.
 * * disconnectedDevice: Fired when a device is no longer connected.
 *
 * This class will attempt to manage any USB devices that match the filter you
 * provide in the constructor. If you instantiate it multiple times you must use
 * different USBDeviceFilters, otherwise managers will start managing each other's
 * devices. This will very likely lead to unintended operation.
 */
export class UsbDeviceManager<TDevice extends IDevice> extends EventTarget {
  private usb: USB;

  /** Map of tracked devices to their wrapper objects. */
  private _devices = new Map<USBDevice, TDevice>();
  public get devices() { return [...this._devices.values()]; }

  private deviceGetter: DeviceGetter<TDevice>;

  /** Communication behavior when communicating with devices. */
  public deviceCommunicationOptions: IUsbDeviceCommunicationOptions;

  constructor(
    navigatorUsb: USB,
    deviceConstructor: DeviceGetter<TDevice>,
    commOpts?: IUsbDeviceCommunicationOptions
  ) {
    super();
    this.usb = navigatorUsb;
    this.deviceGetter = deviceConstructor;
    this.deviceCommunicationOptions = commOpts ?? {
      debug: true,
      requestOptions: {
        filters: [{
          vendorId: 0x0a5f // Zebra
        }]
      }
    };

    this.usb.addEventListener('connect', this.handleConnect.bind(this));
    this.usb.addEventListener('disconnect', this.handleDisconnect.bind(this));
  }

  public addEventListener<T extends keyof IUsbDeviceManagerEventMap<TDevice>>(
    type: T,
    listener: EventListenerObject | null | ((this: UsbDeviceManager<TDevice>, ev: IUsbDeviceManagerEventMap<TDevice>[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options);
  }

  /** Ask the user to connect to a device, using the filter from deviceCommunicationOptions. */
  public async promptForNewDevice(): Promise<boolean> {
    try {
      const device = await this.usb.requestDevice(this.deviceCommunicationOptions.requestOptions);
      await this.handleConnect(new USBConnectionEvent('connect', { device }));
    } catch (e) {
      // User cancelled
      if (
        e instanceof DOMException &&
        e.name === 'NotFoundError' &&
        e.message.endsWith('No device selected.')
      ) {
        return false;
      }
      throw e;
    }
    return true;
  }

  /** Disconnect then reconnect all devices */
  public async forceReconnect() {
    const oldList = Array.from(this._devices.values());
    this._devices.clear();
    await Promise.all([...oldList].map(async (value) => value.dispose()));

    const newDevices = await this.usb.getDevices();
    await Promise.all(
      newDevices
        .map((d) => new USBConnectionEvent('connect', { device: d }))
        .map(async (e) => await this.handleConnect(e))
    );
  }

  /** Handler for device connection events. */
  public async handleConnect({ device }: USBConnectionEvent): Promise<void> {
    // Make sure it's a device this manager cares about.
    if (!this.isManageableDevice(device)) {
      // Whatever device this is it isn't one we'd be able to ask the user to
      // connect to. We shouldn't attempt to talk to it.
      return;
    }

    // Only handle registration if we aren't already tracking a device
    let dev = this._devices.get(device)
    if (dev === undefined) {
      dev = this.deviceGetter(device, this.deviceCommunicationOptions);
      this._devices.set(device, dev);
    }

    // Don't notify that the device exists until it's ready to exist.
    await dev.ready;

    this.sendEvent('connectedDevice', { device: dev });
  }

  /** Handler for device disconnection events. */
  public async handleDisconnect({ device }: USBConnectionEvent): Promise<void> {
    const dev = this._devices.get(device);
    if (dev === undefined) {
      return;
    }
    this._devices.delete(device);
    await dev.dispose();

    this.sendEvent('disconnectedDevice', { device: dev });
  }

  private sendEvent(
    eventName: keyof IUsbDeviceManagerEventMap<TDevice>,
    detail: IDeviceEvent<TDevice>
  ): boolean {
    return super.dispatchEvent(new CustomEvent<IDeviceEvent<TDevice>>(eventName, { detail }));
  }

  /** Determine if a given device is allowed to be managed by this manager. */
  private isManageableDevice(device: USBDevice): boolean {
    const filters = this.deviceCommunicationOptions.requestOptions.filters;
    const exclusionFilters = this.deviceCommunicationOptions.requestOptions.exclusionFilters ?? [];

    // Step 1: Look for filters where the device doesn't match.
    const shouldBeFiltered = filters.map(filter => {
      return (filter.vendorId   !== undefined && filter.vendorId     !== device.vendorId)
        || (filter.productId    !== undefined && filter.productId    !== device.productId)
        || (filter.classCode    !== undefined && filter.classCode    !== device.deviceClass)
        || (filter.subclassCode !== undefined && filter.subclassCode !== device.deviceSubclass)
        || (filter.protocolCode !== undefined && filter.protocolCode !== device.deviceProtocol)
        || (filter.serialNumber !== undefined && filter.serialNumber !== device.serialNumber);
    });
    if (shouldBeFiltered.some(r => r === true)) {
      return false;
    }

    // Step 2: Look for exclusions where the device does match.
    const shouldBeExcluded = exclusionFilters.map(filter => {
      return (filter.vendorId   !== undefined && filter.vendorId     === device.vendorId)
        || (filter.productId    !== undefined && filter.productId    === device.productId)
        || (filter.classCode    !== undefined && filter.classCode    === device.deviceClass)
        || (filter.subclassCode !== undefined && filter.subclassCode === device.deviceSubclass)
        || (filter.protocolCode !== undefined && filter.protocolCode === device.deviceProtocol)
        || (filter.serialNumber !== undefined && filter.serialNumber === device.serialNumber);
    });
    if (shouldBeExcluded.some(r => r === true)) {
      return false;
    }

    return true;
  }
}
