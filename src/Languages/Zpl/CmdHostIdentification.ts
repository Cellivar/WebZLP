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
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  // Each line is wrapped in an STX_ETX\r\n pattern. Make sure there's one there
  const msgStart = msg.indexOf(Util.AsciiCodeStrings.STX);
  if (msgStart === -1) {
    // Not the message we were looking for?
    return result;
  }
  // This should be the first line, which we can validate.
  const line1Maybe = msg.substring(msgStart);

  const {sliced, remainder} = Util.sliceToCRLF(line1Maybe);

  // Message format is documented as:
  // XXXXXX,V1.0.0,dpm,000KB,X
  // My LP2844-Z looks like this
  // LP2844-Z,V45.11.7Z   ,8,8192KB
  // My ZP505 (FedEx) looks like this??
  // ZP 500 (ZPL)-200dpi,ZSP-002281B,8,2104KB
  // So, field 1 and field 2 are basically anything goes.c
  // The second field should have a consistent pattern.
  // ASSUMPTION: Min 4 fields always?

  // Several other commands have STX<data>>ETX patterns too.
  if (sliced.at(0) !== AsciiCodeStrings.STX
    || sliced.at(-1) !== AsciiCodeStrings.ETX) {
    return result;
  }

  const line = sliced.slice(1, -1).split(',');

  // At least 4 items should always be present, with an optional 5th.
  // The memory size should always end in 'KB', supposedly.
  if (line.length < 4 || !line.at(3)?.endsWith('KB')) {
    return result;
  }

  // Okay this is our message.
  result.messageMatchedExpectedCommand = true;
  result.remainder = msg.substring(0, msgStart) + remainder;

  if (window.location.hostname === "localhost") {
    console.debug("Full ZPL host ident:\n", sliced);
  }

  result.messages.push({
    messageType: 'SettingUpdateMessage',
    printerHardware: {
      // Note that the model here is different than the USB descriptor.
      // For consistenty we ignore these and get them from the CmdXmlQuery.
      //model: line.at(0)?.trim(),

      firmware: line.at(1)?.trim(),

      // For DPI ZPL says multiply by 25 to get DPI from DPM.
      //dpi: Number(line.at(2)) * 25,

      // Memory size always (?) ends in 'KB'.
      //memorySize: Number(line.at(3)?.slice(0, -2)),

      // The ZPL docs speak of a mysterious 5th field which my printers don't have.
      // "recognizable options"
      // "only options specific to printer are shown (cutter, options, et cetera.)"
      // If you go looking at the 2003 version of the manual the description is:
      // "recognizable OBJECTS"
      // and clarifies that these are options attached to the printer. There is
      // no listing of what these look like.

      // TODO: figure out what these could possibly be.
    },
    printerMedia: {}
  });

  return result;
}
