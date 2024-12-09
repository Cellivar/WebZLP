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
  }

  // See if the model name gets a hit in the EPL database
  const eplModel = Epl.tryGetModel(deviceInfo.productName);
  if (eplModel !== undefined) {
    return Conf.PrinterCommandLanguage.epl;
  }

  // TODO: More languages
  return Conf.PrinterCommandLanguage.none;
}
