import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import type { NetworkIpResolutionMode } from './Config.js';

const networkIpToCmd: Record<NetworkIpResolutionMode, string> = {
  ALL: 'A',
  BOOTP: 'B',
  DHCP_AND_BOOTP: 'C',
  DHCP: 'D',
  GLEANING: 'G',
  RARP: 'R',
  PERMANENT: 'P'
}

export class CmdSetNetworkIpResolutionMode implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdSetNetworkIpResolutionMode");
  typeExtended = CmdSetNetworkIpResolutionMode.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = 'Set the network IP address resolution mode.';
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['altersConfig']);
  toDisplay(): string {
      return `Set IP resolution mode to ${this.ipMode}`;
  }

  constructor(
    public readonly ipMode: NetworkIpResolutionMode,
    public readonly ipAddress: string, // TODO: real types
    public readonly subnetMask: string,
    public readonly defaultGateway: string,
    // TODO: Add support for extended NS/ND commands
    // public readonly winsServerAddress?: string,
    // public readonly timeoutChecking?: boolean,
    // public readonly timeoutValue?: number, // TODO: Clamp 0 to 9999
    // public readonly arpBroadcastInterval?: number, // TODO: Clamp 0 to 30
    // public readonly baseRawPortNumber?: number, // TODO: Clamp 1 through 65535
    // public readonly networkInterface: NetworkInterface = 'ExternalWired',
  ) {}
}

export const cmdSetNetworkIpResolutionModeMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdSetNetworkIpResolutionMode.typeE,
  transpile: handleCmdSetNetworkIpResolutionMode,
}

export function handleCmdSetNetworkIpResolutionMode(
  cmd: Cmds.IPrinterCommand,
): string {
  if (cmd instanceof CmdSetNetworkIpResolutionMode) {
    const ip = networkIpToCmd[cmd.ipMode];
    return `^NS${ip},${cmd.ipAddress},${cmd.subnetMask},${cmd.defaultGateway}`;
  }
  return '';
}
