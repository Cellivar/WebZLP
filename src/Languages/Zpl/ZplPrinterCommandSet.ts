import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { handleMessage } from './Messages.js';
import { CmdXmlQuery, handleCmdXmlQuery } from './CmdXmlQuery.js';

/** Command set for communicating with a ZPL II printer. */
export class ZplPrinterCommandSet extends Cmds.StringCommandSet {
  get documentStartCommands(): Cmds.IPrinterCommand[] {
    // All ZPL documents start with the start-of-document command.
    return [new Cmds.StartLabel()]
  }

  get documentEndCommands(): Cmds.IPrinterCommand[] {
    // All ZPL documents end with the end-of-document command.
    return [new Cmds.EndLabel()]
  }

  protected nonFormCommands: (symbol | Cmds.CommandType)[] = [
    'AutosenseLabelDimensions',
    'PrintConfiguration',
    'RebootPrinter',
    'SetDarkness'
  ];

  constructor(
    extendedCommands: Array<Cmds.IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(Conf.PrinterCommandLanguage.zpl, extendedCommands);

    this.extendedCommandMap.set(CmdXmlQuery.typeE, handleCmdXmlQuery);
  }

  public override expandCommand(cmd: Cmds.IPrinterCommand): Cmds.IPrinterCommand[] {
    switch (cmd.type) {
      default:
        return [];
      case 'QueryConfiguration':
        // Getting the complete config from ZPL requires two steps.
        return [
          new CmdXmlQuery('All'),
        ];
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
  ): string {
    switch (cmd.type) {
      default:
        Util.exhaustiveMatchGuard(cmd.type);
        break;
      case 'CustomCommand':
        return this.getExtendedCommand(cmd)(cmd, docState, this);
      case 'StartLabel':
        return '\n' +'^XA' +'\n';
      case 'EndLabel':
        return '\n' + '^XZ' +'\n';
      case 'NewLabel':
        // Should have been compiled out at a higher step.
        return this.noop;

      case 'RebootPrinter':
        return '~JR';
      case 'QueryConfiguration':
        // Should be split into a composite command prior to running.
        return this.noop;
      case 'PrintConfiguration':
        return '~WC';
      case 'SaveCurrentConfiguration':
        return '^JUS';
      case 'GetStatus':
        // HQES will return errors that other commands will hang on
        // such as media out or head open
        return '~HQES'

      case 'SetPrintDirection':
        return this.setPrintDirectionCommand((cmd as Cmds.SetPrintDirectionCommand).upsideDown);
      case 'SetDarkness':
        return this.setDarknessCommand(cmd as Cmds.SetDarknessCommand, docState);
      case 'AutosenseLabelDimensions':
        return '~JC';
      case 'SetPrintSpeed':
        return this.setPrintSpeedCommand(cmd as Cmds.SetPrintSpeedCommand, docState);
      case 'SetLabelDimensions':
        return this.setLabelDimensionsCommand(cmd as Cmds.SetLabelDimensionsCommand);
      case 'SetLabelHome':
        return this.setLabelHomeCommand(cmd as Cmds.SetLabelHomeCommand);
      case 'SetLabelPrintOriginOffset':
        return this.setLabelPrintOriginOffsetCommand(cmd as Cmds.SetLabelPrintOriginOffsetCommand);
      case 'SetLabelToContinuousMedia':
        return this.setLabelToContinuousMediaCommand(cmd as Cmds.SetLabelToContinuousMediaCommand);
      case 'SetLabelToMarkMedia':
        return this.setLabelToMarkMediaCommand(cmd as Cmds.SetLabelToMarkMediaCommand);
      case 'SetLabelToWebGapMedia':
        return this.setLabelToWebGapMediaCommand(cmd as Cmds.SetLabelToWebGapMediaCommand);

      case 'ClearImageBuffer':
        // Clear image buffer isn't a relevant command on ZPL printers.
        // Closest equivalent is the ~JP (pause and cancel) or ~JA (cancel all) but both
        // affect in-progress printing operations which is unlikely to be desired operation.
        // Translate as a no-op.
        return this.noop;
      case 'SuppressFeedBackup':
        // ZPL needs this for every form printed.
        return '^XB';
      case 'EnableFeedBackup':
        // ZPL doesn't have an enable, it just expects XB for every label
        // that should not back up.
        return this.noop;

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
        // ZPL doesn't have an OOTB cut command except for one printer.
        // Cutter behavior should be managed by the ^MM command instead.
        return this.noop;

      case 'Print':
        return this.printCommand(cmd as Cmds.PrintCommand);
    }
  }

  private getFieldOffsetCommand(
    formMetadata: Cmds.TranspiledDocumentState,
    additionalHorizontal = 0,
    additionalVertical = 0
  ) {
    const xOffset = Math.trunc(formMetadata.horizontalOffset + additionalHorizontal);
    const yOffset = Math.trunc(formMetadata.verticalOffset + additionalVertical);
    return `^FO${xOffset},${yOffset}`;
  }

  private addImageCommand(
    cmd: Cmds.AddImageCommand,
    outDoc: Cmds.TranspiledDocumentState
  ): string {
    // ZPL treats colors as print element enable. 1 means black, 0 means white.
    const bitmap = cmd.bitmap.toInvertedGRF();
    // TODO: support image conversion options.
    //const imageOptions = cmd.imageConversionOptions;

    // ZPL supports compressed binary on pretty much all firmware, default to that.
    // TODO: ASCII-compressed formats are only supported on newer firmware.
    // Implement feature detection into the transpiler operation to choose the most
    // appropriate compression format such as LZ77/DEFLATE compression for Z64.
    const buffer = bitmap.toZebraCompressedGRF();

    // Because the image may be trimmed add an offset command to position to the image data.
    const fieldStart = this.getFieldOffsetCommand(
      outDoc,
      bitmap.boundingBox.paddingLeft,
      bitmap.boundingBox.paddingTop
    );

    const byteLen = bitmap.bytesUncompressed;
    const graphicCmd = `^GFA,${byteLen},${byteLen},${bitmap.bytesPerRow},${buffer}`;

    const fieldEnd = '^FS';

    // Finally, bump the document offset according to the image height.
    outDoc.verticalOffset += bitmap.boundingBox.height;

    return fieldStart + graphicCmd + fieldEnd;
  }

  private setPrintDirectionCommand(upsideDown: boolean) {
    const dir = upsideDown ? 'I' : 'N';
    return `^PO${dir}`;
  }

  private setDarknessCommand(
    cmd: Cmds.SetDarknessCommand,
    docState: Cmds.TranspiledDocumentState
  ) {
    const percent = cmd.darknessPercent / 100.0;
    const dark = Math.ceil(percent * docState.initialConfig.maxMediaDarkness);
    return `~SD${dark}`;
  }

  private setPrintSpeedCommand(
    cmd: Cmds.SetPrintSpeedCommand,
    docState: Cmds.TranspiledDocumentState
  ) {
    const table = docState.initialConfig.speedTable;
    const printSpeed = table.toRawSpeed(cmd.speed);
    const slewSpeed  = table.toRawSpeed(cmd.mediaSlewSpeed);
    // ZPL uses separate print, slew, and backfeed speeds.
    // Not all printers can have a separate backfeed, so re-use print speed.
    return `^PR${printSpeed},${slewSpeed},${printSpeed}`;
  }

  private setLabelDimensionsCommand(cmd: Cmds.SetLabelDimensionsCommand) {
    const width = Math.trunc(cmd.widthInDots);
    let outCmd = `^PW${width}`;

    if (cmd.setsLength && cmd.lengthInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const length = Math.trunc(cmd.lengthInDots);
      const lengthCmd = `^LL${length},N`; // TODO: this probably isn't right
      outCmd += lengthCmd;
    }

    return outCmd;
  }

  private setLabelHomeCommand(cmd: Cmds.SetLabelHomeCommand) {
    const xOffset = Math.trunc(cmd.offset.left);
    const yOffset = Math.trunc(cmd.offset.top);
    return `^LH${xOffset},${yOffset}`;
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Cmds.SetLabelPrintOriginOffsetCommand
  ): string {
    // This ends up being two commands, one to set the top and one to set the
    // horizontal shift. LS moves the horizontal, LT moves the top. LT is
    // clamped to +/- 120 dots, horizontal is 9999.
    const xOffset = Util.clampToRange(Math.trunc(cmd.offset.left), -9999, 9999);
    const yOffset = Util.clampToRange(Math.trunc(cmd.offset.top), -120, 120);
    return `^LS${xOffset}^LT${yOffset}`;
  }

  private setLabelToContinuousMediaCommand(
    cmd: Cmds.SetLabelToContinuousMediaCommand
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return `^MNN^LL${length + gap}`; // TODO: double check this too
  }

  private setLabelToWebGapMediaCommand(
    cmd: Cmds.SetLabelToWebGapMediaCommand
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    return `^MNY^LL${length},Y`;
  }

  private setLabelToMarkMediaCommand(
    cmd: Cmds.SetLabelToMarkMediaCommand
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return `^MNM,${lineOffset}\n^LL${length}`;
  }

  private printCommand(
    cmd: Cmds.PrintCommand
  ): string {
    // TODO: Make sure this actually works this way..
    // According to the docs the first parameter is "total" labels,
    // while the third is duplicates.
    const total = Math.trunc(cmd.labelCount * (cmd.additionalDuplicateOfEach + 1));
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return `^PQ${total},0,${dup},N`; // TODO: is the N here correct??
  }

  private addLineCommand(
    cmd: Cmds.AddLineCommand,
    outDoc: Cmds.TranspiledDocumentState
  ): string {
    return this.lineOrBoxToCmd(
      outDoc,
      cmd.heightInDots,
      cmd.widthInDots,
      cmd.color,
      // A line is just a box filled in!
      Math.min(cmd.heightInDots, cmd.widthInDots)
    );
  }

  private addBoxCommand(
    cmd: Cmds.AddBoxCommand,
    outDoc: Cmds.TranspiledDocumentState,
  ): string {
    return this.lineOrBoxToCmd(
      outDoc,
      cmd.heightInDots,
      cmd.widthInDots,
      Cmds.DrawColor.black,
      cmd.thickness
    );
  }

  private lineOrBoxToCmd(
    outDoc: Cmds.TranspiledDocumentState,
    height: number,
    length: number,
    color: Cmds.DrawColor,
    thickness?: number
  ): string {
    height = Math.trunc(height) || 0;
    length = Math.trunc(length) || 0;
    thickness = Math.trunc(thickness ?? 1) || 1;
    let drawMode: string;
    switch (color) {
      case Cmds.DrawColor.black:
        drawMode = 'B';
        break;
      case Cmds.DrawColor.white:
        drawMode = 'W';
        break;
    }
    const fieldStart = this.getFieldOffsetCommand(outDoc);

    // TODO: Support rounding?
    return [fieldStart, `^GB${length}`, height, thickness, drawMode, '^FS'].join(',');
  }
}
