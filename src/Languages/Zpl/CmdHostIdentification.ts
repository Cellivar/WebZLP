/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export class CmdHostIdentification implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdHostIdentification")
  typeExtended = CmdHostIdentification.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.epl;
  name = 'Get printer identification info';
  type = "CustomCommand" as const;
  effectFlags = Cmds.AwaitsEffect;
  toDisplay() { return this.name; }

  constructor() {}
}

export function handleCmdHostIdentification(
  _cmd: Cmds.IPrinterCommand,
  _docState: Cmds.TranspiledDocumentState,
  _commandSet: Cmds.CommandSet<string>
): string {
  return '~HI\n';
}

export function parseCmdHostIdentification(
  msg: string,
  _cmd: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: "",
  }

  const {sliced, remainder} = Cmds.sliceToCRLF(msg);
  result.remainder = remainder;
  if (sliced.length === 0) {
    return result;
  }

  const update: Cmds.ISettingUpdateMessage = {
    messageType: 'SettingUpdateMessage',
    printerHardware: {},
    printerMedia: {}
  }

  // Message format:
  // XXXXXX,V1.0.0,dpm,000KB,X
  const line = sliced.split(',');

  // TODO: See if these align with the XML config.
  // Model of printer
  //const model = line[0];
  // Version of software
  //const version = line[1];

  // dots/mm
  // 6, 8, 12, or 24 dots/mm printheads
  const dpm = Number(line[2]);
  if (!isNaN(dpm)) {
    update.printerHardware.dpi = dpm * 25;
  }

  // Memory size
  // "512KB" is a 512k printer
  // "2048K" is a 2MB printer, etc.
  //const mem = line[3];

  // "recognizable options"
  // "only options specific to printer are shown (cutter, options, et cetera.)"
  // There is no further details on what this could be. Thank you Zebra.
  // TODO: figure out what these could possibly be.

  return result;
}
