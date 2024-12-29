/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Util from "../../Util/index.js";
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { AsciiCodeStrings } from '../../Util/ASCII.js';

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

export const cmdHostIdentificationMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdHostIdentification.typeE,
  transpile: handleCmdHostIdentification,
  readMessage: parseCmdHostIdentification,
  formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
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
  const {sliced, remainder} = Util.sliceToCRLF(msg);
  result.remainder = remainder;
  if (sliced.length === 0) {
    return result;
  }
  // Response format is a single line starting with STX and ends with ETX\r\n.
  if (sliced.at(0) !== AsciiCodeStrings.STX || sliced.at(-1) !== AsciiCodeStrings.ETX) {
    result.remainder = msg;
    result.messageMatchedExpectedCommand = false;
    return result;
  }

  // Message format is documented as:
  // XXXXXX,V1.0.0,dpm,000KB,X
  // My LP2844-Z looks like this
  // LP2844-Z,V45.11.7Z   ,8,8192KB
  // TThe second field should have a consistent pattern.
  // ASSUMPTION: Min 4 fields always?

  // Several other commands have STX<data>>ETX patterns too.
  // Firmware versions should (?) always start with /^V\d+\./ to disambiguate.
  const line = sliced.split(',');

  if (line.length < 4 || !/^V\d+\./.test(line.at(1) ?? '')) {
    // Not our message!
    result.remainder = msg;
    result.messageMatchedExpectedCommand = false;
    return result;
  }

  // Okay this is our message.

  // The ZPL docs speak of a mysterious 5th field which my printers don't have.
  // "recognizable options"
  // "only options specific to printer are shown (cutter, options, et cetera.)"
  // There are no further details on what this could be. Thank you Zebra.
  // TODO: figure out what these could possibly be.

  result.messages.push({
    messageType: 'SettingUpdateMessage',
    printerHardware: {
      firmware: line.at(1)?.trim(),

      // Note that the model here is different than the USB descriptor.
      // For consistenty we ignore these and get them from the CmdXmlQuery.
      //model: line.at(0)?.trim(),
      //dpi: Number(line.at(2)) * 25, // dots per mm, ZPL says multiply by 25..
    },
    printerMedia: {}
  });

  return result;
}
