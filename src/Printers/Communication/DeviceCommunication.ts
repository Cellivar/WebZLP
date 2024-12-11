import { WebZlpError } from "../../WebZlpError.js";

/** Possible ways to communicate with a device */
export type DeviceChannelType
  = "USB"
  | "Serial"
  | "Bluetooth"
  | "Network"

/** Whether data can be transmitted or received from the device. */
export enum ConnectionDirectionMode {
  none,
  unidirectional,
  bidirectional
}

export interface IDeviceCommunicationOptions {
  /** Whether to display printer communication to the dev console. */
  debug: boolean;

  /** Milliseconds to wait for messages from a device before assuming it's done talking. Defaults to 500ms. */
  messageWaitTimeoutMS?: number
}

export interface IDevice {
  /** Close the connection to this device and clean up unmanaged resources. */
  dispose(): Promise<void>;

  /** Whether the device is connected. */
  get connected(): boolean;

  /** A promise indicating this device is ready to be used. */
  ready: Promise<boolean>;
}

export interface IDeviceEvent<TDevice> {
  device: TDevice;
}

/** Static metadata for a connected device. */
export interface IDeviceInformation {
  readonly manufacturerName?: string | undefined;
  readonly productName?: string | undefined;
  readonly serialNumber?: string | undefined;
}

/** A communication channel for talking to a device. */
export interface IDeviceChannel<TOutput, TInput> {
  /** Gets the mode the communication is set up as. */
  get commMode(): ConnectionDirectionMode;

  /** Gets this channel type. */
  readonly channelType: DeviceChannelType;

  /** A promise indicating this communication channel is ready for use. */
  get ready(): Promise<boolean>;

  /** Whether the device is connected. */
  get connected(): boolean;

  /** Close the channel, disallowing future communication. */
  dispose(): Promise<void>;

  /** Gets the basic information for the device connected on this channel. */
  getDeviceInfo(): IDeviceInformation

  /**
   * Send a series of commands to the device.
   * @param commandBuffer The series of commands to send in order.
   */
  sendCommands(commandBuffer: TOutput): Promise<DeviceCommunicationError | undefined>;

  /** Request data from the device. */
  getInput(): Promise<TInput[] | DeviceCommunicationError>;
}

/** Error indicating communication with the device has failed. */
export class DeviceCommunicationError extends WebZlpError {
  constructor(message?: string, innerException?: Error) {
    super(message ?? innerException?.message ?? 'Error communicating with device');
    this.innerException = innerException;
  }

  innerException?: Error;
}

/** Error indicating the device was not ready to communicate */
export class DeviceNotReadyError extends DeviceCommunicationError {
  constructor(message?: string, innerException?: Error) {
    super(message ?? innerException?.message ?? 'Device not ready to communicate.');
  }
}
