import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import * as Cmds from "../Commands/index.js";

import * as Zpl from './Zpl/index.js'
import * as Epl from './Epl/index.js'
import type { IDeviceInformation } from 'web-device-mux';

export function getCommandSetForLanguage(lang: Conf.PrinterCommandLanguage): Cmds.CommandSet<Conf.MessageArrayLike> | undefined {
  // In order of preferred communication method
  if (Util.hasFlag(lang, Conf.PrinterCommandLanguage.zpl)) {
    return new Zpl.ZplPrinterCommandSet();
  }
  if (Util.hasFlag(lang, Conf.PrinterCommandLanguage.epl)) {
    return new Epl.EplPrinterCommandSet();
  }
  return undefined;
}

export function guessLanguageFromModelHint(deviceInfo?: IDeviceInformation): Conf.PrinterCommandLanguage {
  if (deviceInfo === undefined) { return Conf.PrinterCommandLanguage.none; }

  // TODO: Better way to do this?
  const modelName = deviceInfo.productName ?? '';
  // ZPL printers follow standard formats and can usually be trusted.
  switch (true) {
    case /LP 2824 Plus/gim.test(modelName):
      // LP 2844 Plus
      return Conf.PrinterCommandLanguage.zplEmulateEpl;
    case /\sT?LP28\d4-Z/gim.test(modelName):
      // ZTC LP2844-Z-200dpi
      return Conf.PrinterCommandLanguage.zpl;
    default:
      return Conf.PrinterCommandLanguage.none;
  }

  // EPL printers are all over the place. They range from blank to straight up lies.
  // I have an LP 2844 that claims to be a TPL2844 (it is not).
  // I have a FedEx unit that is blank.
  // I have a UPS unit that says UPS. I have another one that doesn't.
  // EPL printer model hints are not to be trusted.

  // I don't have a CPCL printer to test and see what it might say. Someday I
  // may get my hands on one to test. If you'd like me to try one out contact me!
  // I'll be happy to discuss sending one to me to test and implement then send back.
}
