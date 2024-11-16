import * as Options from '../../Printers/Configuration/PrinterOptions.js';
import * as Commands from '../../Documents/index.js';
import { WebZlpError } from '../../WebZlpError.js';
import * as Options from '../Configuration/PrinterOptions.js';
import { PrinterOptions } from '../Configuration/PrinterOptions.js';
import { PrinterModelDb } from '../Models/PrinterModelDb.js';
import { PrinterModel } from '../Models/PrinterModel.js';
import * as Commands from '../../Documents/Commands.js';
import { clampToRange } from '../../NumericRange.js';
import { PrinterCommandLanguage } from '../index.js';
import { StringCommandSet } from '../StringCommandSet.js';
import { exhaustiveMatchGuard } from '../../EnumUtils.js';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends StringCommandSet {
  get documentStartCommands(): Commands.IPrinterCommand[] {
    // All ZPL documents start with the start-of-document command.
    return [new Commands.ClearImageBufferCommand()]
  }

  get documentEndCommands(): Commands.IPrinterCommand[] {
    // There's no formal command for the end of an EPL doc
    return []
  }

  public encodeCommand(str = '', withNewline = true): string {
    // Every command in EPL ends with a newline.
    return str + (withNewline ? '\r\n' : '');
  }

  public getNewTranspileState(
    media: Options.IPrinterLabelMediaOptions
  ): Commands.TranspiledDocumentState {
    return {

    }
  }

  protected nonFormCommands: (symbol | Commands.CommandType)[] = [
    'AutosenseLabelDimensions',
    'PrintConfiguration',
    'QueryConfiguration',
    'RebootPrinter'
  ];

  constructor(
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(PrinterCommandLanguage.epl, extendedCommands);
  }

  public transpileCommand(
    cmd: Commands.IPrinterCommand,
    docState: Commands.TranspiledDocumentState
  ): string {
    switch (cmd.type) {
      default:
        exhaustiveMatchGuard(cmd.type);
        break;
      case 'CustomCommand':
        return this.extendedCommandHandler(cmd, docState);
      case 'StartLabel':
        return '\r\nN\r\n'
      case 'EndLabel':
      case 'NewLabel':
        // Should have been compiled out at a higher step.
        return this.noop;

      case 'RebootPrinter':
        return this.encodeCommand('^@');
      case 'QueryConfiguration':
        return this.encodeCommand('UQ');
      case 'PrintConfiguration':
        return this.encodeCommand('U');
      case 'SaveCurrentConfiguration':
        // EPL doesn't have an explicit save step.
        return this.noop;
      case 'GetStatus':
        // Referred to as 'return error' but really returns general status info.
        return this.encodeCommand('^ee');

      case 'SetPrintDirection':
        return this.setPrintDirectionCommand((cmd as Commands.SetPrintDirectionCommand).upsideDown);
      case 'SetDarkness':
        return this.setDarknessCommand((cmd as Commands.SetDarknessCommand).darknessSetting);
      case 'AutosenseLabelDimensions':
        return this.encodeCommand('xa');
      case 'SetPrintSpeed':
        // EPL has no separate media slew speed setting.
        return this.setPrintSpeedCommand((cmd as Commands.SetPrintSpeedCommand).speedVal);
      case 'SetLabelDimensions':
        return this.setLabelDimensionsCommand(cmd as Commands.SetLabelDimensionsCommand);
      case 'SetLabelHome':
        return this.setLabelHomeCommand(cmd as Commands.SetLabelHomeCommand, docState);
      case 'SetLabelPrintOriginOffset':
        return this.setLabelPrintOriginOffsetCommand(cmd as Commands.SetLabelPrintOriginOffsetCommand);
      case 'SetLabelToContinuousMedia':
        return this.setLabelToContinuousMediaCommand(cmd as Commands.SetLabelToContinuousMediaCommand);
      case 'SetLabelToMarkMedia':
        return this.setLabelToMarkMediaCommand(cmd as Commands.SetLabelToMarkMediaCommand);
      case 'SetLabelToWebGapMedia':
        return this.setLabelToWebGapMediaCommand(cmd as Commands.SetLabelToWebGapMediaCommand);

      case 'ClearImageBuffer':
        return '\r\nN';
      case 'SuppressFeedBackup':
        // EPL uses an on/off style for form backup, it'll remain off until reenabled.
        return this.encodeCommand('JB');
      case 'EnableFeedBackup':
        // Thus EPL needs an explicit command to re-enable.
        return this.encodeCommand('JF');

      case 'Offset':
        return this.modifyOffset(cmd as Commands.OffsetCommand, docState);
      case 'Raw':
        return this.encodeCommand((cmd as Commands.Raw).rawDocument, false);
      case 'AddBox':
        return this.addBoxCommand(cmd as Commands.AddBoxCommand, docState);
      case 'AddImage':
        return this.addImageCommand(cmd as Commands.AddImageCommand, docState);
      case 'AddLine':
        return this.addLineCommand(cmd as Commands.AddLineCommand, docState);
      case 'CutNow':
        return this.encodeCommand('C');

      case 'Print':
        return this.printCommand(cmd as Commands.PrintCommand);
    }
  }

  private setPrintDirectionCommand(
    upsideDown: boolean
  ): string {
    const dir = upsideDown ? 'T' : 'B';
    return this.encodeCommand(`Z${dir}`);
  }

  private setDarknessCommand(
    darkness: number
  ): string {
    const dark = Math.trunc(darkness);
    return this.encodeCommand(`D${dark}`);
  }

  private setPrintSpeedCommand(
    speed: number
  ): string {
    // Validation should have happened on setup, printer will just reject
    // invalid speeds.
    return this.encodeCommand(`S${speed}`);
  }

  private setLabelDimensionsCommand(
    cmd: Commands.SetLabelDimensionsCommand,
  ): string {
    const width = Math.trunc(cmd.widthInDots);
    const widthCmd = this.encodeCommand(`q${width}`);
    if (cmd.setsHeight && cmd.heightInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const height = Math.trunc(cmd.heightInDots);
      const gap = Math.trunc(cmd.gapLengthInDots);
      const heightCmd = this.encodeCommand(`Q${height},${gap}`);
      return this.combineCommands(widthCmd, heightCmd);
    }
    return widthCmd;
  }

  private setLabelHomeCommand(
    cmd: Commands.SetLabelHomeCommand,
    outDoc: Commands.TranspiledDocumentState
  ): string {
    return this.modifyOffset(
      new Commands.OffsetCommand(cmd.offset.left, cmd.offset.top, true),
      outDoc
    );
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Commands.SetLabelPrintOriginOffsetCommand,
  ): string {
    const xOffset = Math.trunc(cmd.offset.left);
    const yOffset = Math.trunc(cmd.offset.top);
    return this.encodeCommand(`R${xOffset},${yOffset}`);
  }

  private setLabelToContinuousMediaCommand(
    cmd: Commands.SetLabelToContinuousMediaCommand,
  ): string {
    // EPL seems to not have a static label length? All labels are variable?
    // Needs testing.
    const length = Math.trunc(cmd.labelLengthInDots);
    return this.encodeCommand(`Q${length},0`);
  }

  private setLabelToWebGapMediaCommand(
    cmd: Commands.SetLabelToWebGapMediaCommand,
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return this.encodeCommand(`Q${length},${gap}`);
  }

  private setLabelToMarkMediaCommand(
    cmd: Commands.SetLabelToMarkMediaCommand,
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineLength = Math.trunc(cmd.blackLineThicknessInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return this.encodeCommand(`Q${length},B${lineLength},${lineOffset}`);
  }

  private printCommand(
    cmd: Commands.PrintCommand,
  ): string {
    const total = Math.trunc(cmd.labelCount);
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return this.encodeCommand(`P${total},${dup}`);
  }

  private addImageCommand(
    cmd: Commands.AddImageCommand,
    outDoc: Commands.TranspiledDocumentState,
  ): string {
    // EPL only supports raw binary, get that.
    const bitmap = cmd.bitmap;
    const rawBitmap = bitmap.toBinaryGRF();
    const decoder = new TextDecoder("ascii");
    const buffer = decoder.decode(rawBitmap);

    // Add the text command prefix to the buffer data
    const parameters = [
      'GW' + Math.trunc(outDoc.horizontalOffset + bitmap.boundingBox.paddingLeft),
      Math.trunc(outDoc.verticalOffset + bitmap.boundingBox.paddingTop),
      bitmap.bytesPerRow,
      bitmap.height
    ];
    // Bump the offset according to the image being added.
    outDoc.verticalOffset += bitmap.boundingBox.height;
    const rawCmd = this.encodeCommand(parameters.join(',') + ',', false);
    return this.combineCommands(
      rawCmd,
      this.combineCommands(buffer, this.encodeCommand(''))
    );
  }

  private addLineCommand(
    cmd: Commands.AddLineCommand,
    outDoc: Commands.TranspiledDocumentState,
  ): string {
    const length = Math.trunc(cmd.lengthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    let drawMode = 'LO';
    switch (cmd.color) {
      case Commands.DrawColor.black:
        drawMode = 'LO';
        break;
      case Commands.DrawColor.white:
        drawMode = 'LW';
        break;
    }

    return this.encodeCommand(
      `${drawMode}${outDoc.horizontalOffset},${outDoc.verticalOffset},${length},${height}`
    );
  }

  private addBoxCommand(
    cmd: Commands.AddBoxCommand,
    outDoc: Commands.TranspiledDocumentState,
  ): string {
    const length = Math.trunc(cmd.lengthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    const thickness = Math.trunc(cmd.thickness) || 0;

    return this.encodeCommand(
      `X${outDoc.horizontalOffset},${outDoc.verticalOffset},${thickness},${length},${height}`
    );
  }
}
