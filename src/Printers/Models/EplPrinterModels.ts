import { PrinterModel, BasePrinterInfo, SpeedTable } from './PrinterModel.js';
import { PrintSpeed } from '../Configuration/PrinterOptions.js';
import { PrinterCommandLanguage } from '../../Languages/index.js';

/** EPL printers have a lot in common. */
export abstract class EplPrinter extends BasePrinterInfo {
  get commandLanguage(): PrinterCommandLanguage {
    return PrinterCommandLanguage.epl;
  }

  get maxDarkness(): number {
    return 15; // EPL max darkness
  }
}

/** 28XX model printers are mostly the same */
export abstract class LP28XX extends EplPrinter {
  get dpi(): number {
    return 203;
  }

  abstract get model(): PrinterModel;

  private _speedTable = new SpeedTable(new Map<PrintSpeed, number>([
    [PrintSpeed.ipsAuto, 3],
    [PrintSpeed.ipsPrinterMax, 4],
    [PrintSpeed.ipsPrinterMin, 1],
    [PrintSpeed.ips1_5, 1],
    [PrintSpeed.ips2, 2],
    [PrintSpeed.ips2_5, 3],
    [PrintSpeed.ips3_5, 4]
  ]));
  get speedTable() { return this._speedTable; }
}

export class LP2844 extends LP28XX {
  get model() {
    return PrinterModel.lp2824;
  }
}

export class LP2824 extends LP28XX {
  get model() {
    return PrinterModel.lp2824;
  }
}

export class TLP2824 extends LP28XX {
  get model() {
    return PrinterModel.tlp2824;
  }
}

export class TLP2844 extends LP28XX {
  get model() {
    return PrinterModel.tlp2844;
  }
}
