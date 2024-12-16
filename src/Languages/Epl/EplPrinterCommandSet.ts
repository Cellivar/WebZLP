import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { handleMessage } from './Messages.js';
import { CmdErrorReporting, handleCmdErrorReporting } from './CmdErrorReporting.js';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends Cmds.StringCommandSet {
  override get documentStartPrefix() { return '\r\n'; };
  override get documentEndSuffix() { return '\r\n'; };

  // TODO: Method to add extended commands to the non-form list.
  protected nonFormCommands: (symbol | Cmds.CommandType)[] = [
    'AutosenseLabelDimensions',
    'PrintConfiguration',
    'QueryConfiguration',
    'RebootPrinter',
    'SetDarkness',
    'StartLabel',
    'CutNow',
    'ClearImageBuffer',
    'GetStatus',
    'SaveCurrentConfiguration',
    CmdErrorReporting.typeE
  ];

  constructor(
    extendedCommands: Array<Cmds.IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(Conf.PrinterCommandLanguage.epl, extendedCommands);

    this.extendedCommandMap.set(CmdErrorReporting.typeE, handleCmdErrorReporting);
  }

  public override expandCommand(cmd: Cmds.IPrinterCommand): Cmds.IPrinterCommand[] {
    switch (cmd.type) {
      default:
        return [];
      case 'Identify':
        return [new Cmds.GetStatusCommand()]
      case 'NewLabel':
        return [
          new Cmds.EndLabel(),
          new Cmds.StartLabel()
        ]
    }
  }

  public parseMessage<TReceived extends Conf.MessageArrayLike>(
    msg: TReceived,
    sentCommand?: Cmds.IPrinterCommand
  ): Cmds.IMessageHandlerResult<TReceived> {
    return handleMessage(msg, sentCommand);
  }

  public transpileCommand(
    cmd: Cmds.IPrinterCommand,
    docState: Cmds.TranspiledDocumentState
  ): string | Cmds.TranspileDocumentError {
    switch (cmd.type) {
      default:
        Util.exhaustiveMatchGuard(cmd.type);
        break;
      case 'CustomCommand':
        return this.getExtendedCommand(cmd)(cmd, docState, this);
      case 'StartLabel':
      case 'ClearImageBuffer':
        return '\r\n' + 'N' + '\r\n';
      case 'EndLabel':
        // No specific command, prints should have happened.
        return '\r\n';

      case 'Identify':
      case 'NewLabel':
      case 'NoOp':
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
        return '\r\n' + '^ee' + '\r\n';

      case 'SetPrintDirection':
        return this.setPrintDirectionCommand((cmd as Cmds.SetPrintDirectionCommand).upsideDown);
      case 'SetDarkness':
        return this.setDarknessCommand(cmd as Cmds.SetDarknessCommand, docState);
      case 'AutosenseLabelDimensions':
        return 'xa' + '\r\n';
      case 'SetPrintSpeed':
        // EPL has no separate media slew speed setting.
        return this.setPrintSpeedCommand(cmd as Cmds.SetPrintSpeedCommand, docState);
      case 'SetLabelDimensions':
        return this.setLabelDimensionsCommand(cmd as Cmds.SetLabelDimensionsCommand);
      case 'SetLabelHome':
        return this.setLabelHomeCommand(cmd as Cmds.SetLabelHomeCommand, docState);
      case 'SetLabelPrintOriginOffset':
        return this.setLabelPrintOriginOffsetCommand(cmd as Cmds.SetLabelPrintOriginOffsetCommand);
      case 'SetLabelToContinuousMedia':
        return this.setLabelToContinuousMediaCommand(cmd as Cmds.SetLabelToContinuousMediaCommand);
      case 'SetLabelToMarkMedia':
        return this.setLabelToMarkMediaCommand(cmd as Cmds.SetLabelToMarkMediaCommand);
      case 'SetLabelToWebGapMedia':
        return this.setLabelToWebGapMediaCommand(cmd as Cmds.SetLabelToWebGapMediaCommand);
      case 'SetBackfeedAfterTaken':
        return this.setBackfeedAfterTaken((cmd as Cmds.SetBackfeedAfterTakenMode).mode);

      case 'Offset':
        return this.applyOffset(cmd as Cmds.OffsetCommand, docState);
      case 'Raw':
        return (cmd as Cmds.Raw).rawDocument;
      case 'AddBox':
        return this.addBoxCommand(cmd as Cmds.AddBoxCommand, docState);
      case 'AddImage':
        return this.addImageCommand(cmd as Cmds.AddImageCommand, docState);
      case 'AddLine':
        return this.addLineCommand(cmd as Cmds.AddLineCommand, docState);
      case 'CutNow':
        return 'C' + '\r\n';

      case 'Print':
        return this.printCommand(cmd as Cmds.PrintCommand);
    }
  }

  private setBackfeedAfterTaken(
    mode: Conf.BackfeedAfterTaken
  ): string {
    if (mode === 'disabled') {
      // TODO: Does JC matter? It's only supported on 28X4
      // Send JB first for universal support and JC after just in case?
      return `JB\r\nJC\r\n`
    } else {
      // EPL doesn't support percentages so just turn it on.
      return `JF` + '\r\n';
    }
  }

  private setPrintDirectionCommand(
    upsideDown: boolean
  ): string {
    const dir = upsideDown ? 'T' : 'B';
    return `Z${dir}` + '\r\n';
  }

  private setDarknessCommand(
    cmd: Cmds.SetDarknessCommand,
    docState: Cmds.TranspiledDocumentState
  ): string {
    const percent = cmd.darknessPercent / 100.0;
    const dark = Math.ceil(percent * docState.initialConfig.maxMediaDarkness);
    return `D${dark}` + '\r\n';
  }

  private setPrintSpeedCommand(
    cmd: Cmds.SetPrintSpeedCommand,
    docState: Cmds.TranspiledDocumentState
  ): string {
    const table = docState.initialConfig.speedTable;
    const printSpeed = table.toRawSpeed(cmd.speed);
    // Validation should have happened on setup, printer will just reject
    // invalid speeds.
    return `S${printSpeed}` + '\r\n';
  }

  private setLabelDimensionsCommand(
    cmd: Cmds.SetLabelDimensionsCommand,
  ): string {
    const width = Math.trunc(cmd.widthInDots);
    let outCmd = `q${width}` + '\r\n';

    if (cmd.setsLength && cmd.lengthInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const length = Math.trunc(cmd.lengthInDots);
      const gap = Math.trunc(cmd.gapLengthInDots);
      outCmd += `Q${length},${gap}` + '\r\n';
    }

    return outCmd;
  }

  private setLabelHomeCommand(
    cmd: Cmds.SetLabelHomeCommand,
    outDoc: Cmds.TranspiledDocumentState
  ): string {
    return this.applyOffset(
      new Cmds.OffsetCommand(cmd.offset.left, cmd.offset.top, true),
      outDoc
    );
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Cmds.SetLabelPrintOriginOffsetCommand,
  ): string {
    const xOffset = Math.trunc(cmd.offset.left);
    const yOffset = Math.trunc(cmd.offset.top);
    return `R${xOffset},${yOffset}` + '\r\n';
  }

  private setLabelToContinuousMediaCommand(
    cmd: Cmds.SetLabelToContinuousMediaCommand,
  ): string {
    // EPL seems to not have a static label length? All labels are variable?
    // Needs testing.
    const length = Math.trunc(cmd.labelLengthInDots);
    return `Q${length},0` + '\r\n';
  }

  private setLabelToWebGapMediaCommand(
    cmd: Cmds.SetLabelToWebGapMediaCommand,
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return `Q${length},${gap}` + '\r\n';
  }

  private setLabelToMarkMediaCommand(
    cmd: Cmds.SetLabelToMarkMediaCommand,
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineLength = Math.trunc(cmd.blackLineThicknessInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return `Q${length},B${lineLength},${lineOffset}` + '\r\n';
  }

  private printCommand(
    cmd: Cmds.PrintCommand,
  ): string {
    const total = Math.trunc(cmd.labelCount);
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return `P${total},${dup}` + '\r\n';
  }

  private addImageCommand(
    cmd: Cmds.AddImageCommand,
    outDoc: Cmds.TranspiledDocumentState,
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
    cmd: Cmds.AddLineCommand,
    outDoc: Cmds.TranspiledDocumentState,
  ): string {
    const length = Math.trunc(cmd.widthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    let drawMode = 'LO';
    switch (cmd.color) {
      case Cmds.DrawColor.black:
        drawMode = 'LO';
        break;
      case Cmds.DrawColor.white:
        drawMode = 'LW';
        break;
    }

    const params = [outDoc.horizontalOffset, outDoc.verticalOffset, length, height]
    return drawMode + params.join(',') + '\r\n';
  }

  private addBoxCommand(
    cmd: Cmds.AddBoxCommand,
    outDoc: Cmds.TranspiledDocumentState,
  ): string {
    const length = Math.trunc(cmd.widthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    const thickness = Math.trunc(cmd.thickness) || 0;


    const params = [outDoc.horizontalOffset, outDoc.verticalOffset, thickness, length, height]
    return 'X' + params.join(',') + '\r\n';
  }
}
