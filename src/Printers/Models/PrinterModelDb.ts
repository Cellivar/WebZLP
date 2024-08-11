import { PrinterModel } from './PrinterModel.js';
import { PrinterCommandLanguage } from '../Configuration/PrinterOptions.js';
import * as EPL from './EplPrinterModels.js';
import { type IPrinterModelInfo, UnknownPrinter } from './PrinterModel.js';
import type { IDeviceInformation } from 'web-device-mux';

export class PrinterModelDb {
  /** Determine a printer model based on the printer-reported model. */
  public static getModel(rawModelId?: string): PrinterModel {
    if (rawModelId === undefined) {
      return PrinterModel.unknown;
    }
    // Easy mode: if it ends in FDX it's a fedex LP2844
    if (rawModelId.endsWith('FDX')) {
      return PrinterModel.lp2844fedex;
    }
    if (rawModelId.endsWith('UPS')) {
      return PrinterModel.lp2844ups;
    }

    // Hard mode: Model correlation between observed values and output.
    // This is pretty much all based off of observed values, I can't find a mapping
    // of the config's model number vs the hardware model number.
    // TODO: Make this extensible so it's possible for consumers to add their own
    // printers to the enum, match list, etc.
    switch (rawModelId) {
      case 'UKQ1915 U':
        // TODO: This is an educated guess, validate it!
        return PrinterModel.tlp2824;
      case 'UKQ1935 U':
        return PrinterModel.tlp2844;

      case 'UKQ1915HLU':
        return PrinterModel.lp2824;
      case 'UKQ1935HLU':
        return PrinterModel.lp2844;
      case 'UKQ1935HMU':
        // HMU units that do not have FDX in the version string appear to be UPS
        // units. Maybe. Mostly. It's not clear.
        return PrinterModel.lp2844ups;

      case 'ZPL_AUTODETECT':
        return PrinterModel.zplAutodetect;
      case 'LP2824-Z-200dpi':
        return PrinterModel.lp2824z;
      case 'LP2844-Z-200dpi':
        return PrinterModel.lp2844z;
      default:
        return PrinterModel.unknown;
    }
  }

  /** Look up the model information for a given printer model. */
  public static getModelInfo(model: PrinterModel): IPrinterModelInfo {
    // TODO: Make this extensible so it's possible for consumers to add their own
    // printers to the enum, match list, etc.
    switch (model) {
      // LP models, direct thermal only.
      case PrinterModel.lp2824:
        return new EPL.LP2824();
      case PrinterModel.lp2844:
      case PrinterModel.lp2844fedex:
      case PrinterModel.lp2844ups:
        return new EPL.LP2844();

      // TLP models, direct thermal or thermal transfer.
      case PrinterModel.tlp2824:
        return new EPL.TLP2824();
      case PrinterModel.tlp2844:
        return new EPL.TLP2844();

      default:
        return new UnknownPrinter();
    }
  }

  public static guessLanguageFromModelHint(deviceInfo?: IDeviceInformation): PrinterCommandLanguage {
    if (deviceInfo === undefined) { return PrinterCommandLanguage.none; }

    const modelName = deviceInfo.productName ?? '';
    // ZPL printers tend to be more trustworthy. They will follow a more standard
    // format.
    switch (true) {
      // LP2844-Z
      // ZTC LP2844-Z-200dpi
      case /LP 2824 Plus/gim.test(modelName):
      case /\sLP2844-Z-200dpi/gim.test(modelName):
      case /\sLP2824-Z-200dpi/gim.test(modelName):
        return PrinterCommandLanguage.zplEmulateEpl;
      default:
        return PrinterCommandLanguage.none;
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
}
