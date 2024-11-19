import * as Commands from '../../Documents/index.js';
import * as Messages from '../index.js';
import { exhaustiveMatchGuard } from '../../EnumUtils.js';
import { handleMessage } from './Messages.js';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends Messages.StringCommandSet {
  get documentStartCommands(): Commands.IPrinterCommand[] {
    // All ZPL documents start with the start-of-document command.
    return [new Commands.ClearImageBufferCommand()]
  }

  get documentEndCommands(): Commands.IPrinterCommand[] {
    // There's no formal command for the end of an EPL doc
    return []
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
    super(Messages.PrinterCommandLanguage.epl, extendedCommands);
  }

  public parseMessage<TReceived extends Messages.MessageArrayLike>(
    msg: TReceived,
    sentCommand?: Commands.IPrinterCommand
  ): Messages.IMessageHandlerResult<TReceived> {
    return handleMessage(msg, sentCommand);
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
        return this.getExtendedCommand(cmd)(cmd, docState, this);
      case 'StartLabel':
        return '\r\n' + 'N' + '\r\n';
      case 'EndLabel':
      case 'NewLabel':
        // Should have been compiled out at a higher step.
        return this.noop;

      case 'RebootPrinter':
        return '^@' + '\r\n';
      case 'QueryConfiguration':
        return 'UQ' + '\r\n';
      case 'PrintConfiguration':
        return 'U' + '\r\n';
      case 'SaveCurrentConfiguration':
        // EPL doesn't have an explicit save step.
        return this.noop;
      case 'GetStatus':
        // Referred to as 'return error' but really returns general status info.
        return '^ee' + '\r\n';

      case 'SetPrintDirection':
        return this.setPrintDirectionCommand((cmd as Commands.SetPrintDirectionCommand).upsideDown);
      case 'SetDarkness':
        return this.setDarknessCommand((cmd as Commands.SetDarknessCommand).darknessSetting);
      case 'AutosenseLabelDimensions':
        return 'xa' + '\r\n';
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
        return 'JB' + '\r\n';
      case 'EnableFeedBackup':
        // Thus EPL needs an explicit command to re-enable.
        return 'JF' + '\r\n';

      case 'Offset':
        return this.applyOffset(cmd as Commands.OffsetCommand, docState);
      case 'Raw':
        return (cmd as Commands.Raw).rawDocument;
      case 'AddBox':
        return this.addBoxCommand(cmd as Commands.AddBoxCommand, docState);
      case 'AddImage':
        return this.addImageCommand(cmd as Commands.AddImageCommand, docState);
      case 'AddLine':
        return this.addLineCommand(cmd as Commands.AddLineCommand, docState);
      case 'CutNow':
        return 'C' + '\r\n';

      case 'Print':
        return this.printCommand(cmd as Commands.PrintCommand);
    }
  }

  private setPrintDirectionCommand(
    upsideDown: boolean
  ): string {
    const dir = upsideDown ? 'T' : 'B';
    return `Z${dir}` + '\r\n';
  }

  private setDarknessCommand(
    darkness: number
  ): string {
    const dark = Math.trunc(darkness);
    return `D${dark}` + '\r\n';
  }

  private setPrintSpeedCommand(
    speed: number
  ): string {
    // Validation should have happened on setup, printer will just reject
    // invalid speeds.
    return `S${speed}` + '\r\n';
  }

  private setLabelDimensionsCommand(
    cmd: Commands.SetLabelDimensionsCommand,
  ): string {
    const width = Math.trunc(cmd.widthInDots);
    let outCmd = `q${width}` + '\r\n';

    if (cmd.setsHeight && cmd.heightInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const height = Math.trunc(cmd.heightInDots);
      const gap = Math.trunc(cmd.gapLengthInDots);
      outCmd += `Q${height},${gap}` + '\r\n';
    }

    return outCmd;
  }

  private setLabelHomeCommand(
    cmd: Commands.SetLabelHomeCommand,
    outDoc: Commands.TranspiledDocumentState
  ): string {
    return this.applyOffset(
      new Commands.OffsetCommand(cmd.offset.left, cmd.offset.top, true),
      outDoc
    );
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Commands.SetLabelPrintOriginOffsetCommand,
  ): string {
    const xOffset = Math.trunc(cmd.offset.left);
    const yOffset = Math.trunc(cmd.offset.top);
    return `R${xOffset},${yOffset}` + '\r\n';
  }

  private setLabelToContinuousMediaCommand(
    cmd: Commands.SetLabelToContinuousMediaCommand,
  ): string {
    // EPL seems to not have a static label length? All labels are variable?
    // Needs testing.
    const length = Math.trunc(cmd.labelLengthInDots);
    return `Q${length},0` + '\r\n';
  }

  private setLabelToWebGapMediaCommand(
    cmd: Commands.SetLabelToWebGapMediaCommand,
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return `Q${length},${gap}` + '\r\n';
  }

  private setLabelToMarkMediaCommand(
    cmd: Commands.SetLabelToMarkMediaCommand,
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineLength = Math.trunc(cmd.blackLineThicknessInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return `Q${length},B${lineLength},${lineOffset}` + '\r\n';
  }

  private printCommand(
    cmd: Commands.PrintCommand,
  ): string {
    const total = Math.trunc(cmd.labelCount);
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return `P${total},${dup}` + '\r\n';
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
      Math.trunc(outDoc.horizontalOffset + bitmap.boundingBox.paddingLeft),
      Math.trunc(outDoc.verticalOffset + bitmap.boundingBox.paddingTop),
      bitmap.bytesPerRow,
      bitmap.height
    ];
    // Bump the offset according to the image being added.
    outDoc.verticalOffset += bitmap.boundingBox.height;
    return 'GW' + parameters.join(',') + ',' + buffer + '\r\n';
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

    const params = [outDoc.horizontalOffset, outDoc.verticalOffset, length, height]
    return drawMode + params.join(',') + '\r\n';
  }

  private addBoxCommand(
    cmd: Commands.AddBoxCommand,
    outDoc: Commands.TranspiledDocumentState,
  ): string {
    const length = Math.trunc(cmd.lengthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    const thickness = Math.trunc(cmd.thickness) || 0;


    const params = [outDoc.horizontalOffset, outDoc.verticalOffset, thickness, length, height]
    return 'X' + params.join(',') + '\r\n';
  }
}
