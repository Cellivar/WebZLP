import * as Options from '../../Configuration/PrinterOptions.js';
import * as Commands from '../../../Documents/index.js';
import { clampToRange } from '../../../NumericRange.js';
import { PrinterCommandLanguage } from '../index.js';
import { StringCommandSet } from '../StringCommandSet.js';
import { exhaustiveMatchGuard } from '../../../EnumUtils.js';

/** Command set for communicating with a ZPL II printer. */
export class ZplPrinterCommandSet extends StringCommandSet {
  get documentStartCommands(): Commands.IPrinterCommand[] {
    // All ZPL documents start with the start-of-document command.
    return [new Commands.StartLabel()]
  }

  get documentEndCommands(): Commands.IPrinterCommand[] {
    // All ZPL documents end with the end-of-document command.
    return [new Commands.EndLabel()]
  }

  public encodeCommand(str = '', withNewline = true): string {
    // TODO: ZPL supports omitting the newline, figure out a clever way to
    // handle situations where newlines are optional to reduce line noise.
    return str + (withNewline ? '\n' : '');
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
    'RebootPrinter',
    'SetDarkness'
  ];

  constructor(
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(PrinterCommandLanguage.zpl, extendedCommands);
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
        return '\n^XA\n';
      case 'EndLabel':
        return '\n^XZ\n';
      case 'NewLabel':
        // Should have been compiled out at a higher step.
        return this.noop;

      case 'RebootPrinter':
        return '~JR';
      case 'QueryConfiguration':
        return '^HZA\r\n^HH';
      case 'PrintConfiguration':
        return '~WC';
      case 'SaveCurrentConfiguration':
        return '^JUS';

      case 'SetPrintDirection':
        return this.setPrintDirectionCommand((cmd as Commands.SetPrintDirectionCommand).upsideDown);
      case 'SetDarkness':
        return this.setDarknessCommand((cmd as Commands.SetDarknessCommand).darknessSetting);
      case 'AutosenseLabelDimensions':
        return '~JC';
      case 'SetPrintSpeed':
        return this.setPrintSpeedCommand(cmd as Commands.SetPrintSpeedCommand);
      case 'SetLabelDimensions':
        return this.setLabelDimensionsCommand(cmd as Commands.SetLabelDimensionsCommand);
      case 'SetLabelHome':
        return this.setLabelHomeCommand(cmd as Commands.SetLabelHomeCommand);
      case 'SetLabelPrintOriginOffset':
        return this.setLabelPrintOriginOffsetCommand(cmd as Commands.SetLabelPrintOriginOffsetCommand);
      case 'SetLabelToContinuousMedia':
        return this.setLabelToContinuousMediaCommand(cmd as Commands.SetLabelToContinuousMediaCommand);
      case 'SetLabelToMarkMedia':
        return this.setLabelToMarkMediaCommand(cmd as Commands.SetLabelToMarkMediaCommand);
      case 'SetLabelToWebGapMedia':
        return this.setLabelToWebGapMediaCommand(cmd as Commands.SetLabelToWebGapMediaCommand);

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
        return this.modifyOffset(cmd as Commands.OffsetCommand, docState);
      case 'Raw':
        return (cmd as Commands.Raw).rawDocument;
      case 'AddBox':
        return this.addBoxCommand(cmd as Commands.AddBoxCommand, docState);
      case 'AddImage':
        return this.addImageCommand(cmd as Commands.AddImageCommand, docState);
      case 'AddLine':
        return this.addLineCommand(cmd as Commands.AddLineCommand, docState);
      case 'CutNow':
        // ZPL doesn't have an OOTB cut command except for one printer.
        // Cutter behavior should be managed by the ^MM command instead.
        return this.noop;

      case 'Print':
        return this.printCommand(cmd as Commands.PrintCommand);
    }
  }

  private getFieldOffsetCommand(
    formMetadata: Commands.TranspiledDocumentState,
    additionalHorizontal = 0,
    additionalVertical = 0
  ) {
    const xOffset = Math.trunc(formMetadata.horizontalOffset + additionalHorizontal);
    const yOffset = Math.trunc(formMetadata.verticalOffset + additionalVertical);
    return `^FO${xOffset},${yOffset}`;
  }

  private addImageCommand(
    cmd: Commands.AddImageCommand,
    outDoc: Commands.TranspiledDocumentState
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

    return this.combineCommands(fieldStart, graphicCmd, fieldEnd);
  }

  private setPrintDirectionCommand(upsideDown: boolean) {
    const dir = upsideDown ? 'I' : 'N';
    return `^PO${dir}`;
  }

  private setDarknessCommand(darkness: number) {
    const dark = Math.trunc(darkness);
    return `~SD${dark}`;
  }

  private setPrintSpeedCommand(cmd: Commands.SetPrintSpeedCommand) {
    // ZPL uses separate print, slew, and backfeed speeds. Re-use print for backfeed.
    return `^PR${cmd.speedVal},${cmd.mediaSpeedVal},${cmd.speedVal}`;
  }

  private setLabelDimensionsCommand(cmd: Commands.SetLabelDimensionsCommand) {
    const width = Math.trunc(cmd.widthInDots);
    const widthCmd = `^PW${width}`;
    if (cmd.setsHeight && cmd.heightInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const height = Math.trunc(cmd.heightInDots);
      const heightCmd = `^LL${height},N`; // TODO: this probably isn't right
      return this.combineCommands(widthCmd, heightCmd);
    }
    return widthCmd;
  }

  private setLabelHomeCommand(cmd: Commands.SetLabelHomeCommand) {
    const xOffset = Math.trunc(cmd.offset.left);
    const yOffset = Math.trunc(cmd.offset.top);
    return `^LH${xOffset},${yOffset}`;
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Commands.SetLabelPrintOriginOffsetCommand
  ): string {
    // This ends up being two commands, one to set the top and one to set the
    // horizontal shift. LS moves the horizontal, LT moves the top. LT is
    // clamped to +/- 120 dots, horizontal is 9999.
    const xOffset = clampToRange(Math.trunc(cmd.offset.left), -9999, 9999);
    const yOffset = clampToRange(Math.trunc(cmd.offset.top), -120, 120);
    return `^LS${xOffset}^LT${yOffset}`;
  }

  private setLabelToContinuousMediaCommand(
    cmd: Commands.SetLabelToContinuousMediaCommand
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return `^MNN^LL${length + gap}`; // TODO: double check this too
  }

  private setLabelToWebGapMediaCommand(
    cmd: Commands.SetLabelToWebGapMediaCommand
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    return `^MNY^LL${length},Y`;
  }

  private setLabelToMarkMediaCommand(
    cmd: Commands.SetLabelToMarkMediaCommand
  ): string {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return `^MNM,${length}^LL${lineOffset}`;
  }

  private printCommand(
    cmd: Commands.PrintCommand
  ): string {
    // TODO: Make sure this actually works this way..
    // According to the docs the first parameter is "total" labels,
    // while the third is duplicates.
    const total = Math.trunc(cmd.labelCount * (cmd.additionalDuplicateOfEach + 1));
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return `^PQ${total},0,${dup},N`; // TODO: is the N here correct??
  }

  private addLineCommand(
    cmd: Commands.AddLineCommand,
    outDoc: Commands.TranspiledDocumentState
  ): string {
    return this.lineOrBoxToCmd(
      outDoc,
      cmd.heightInDots,
      cmd.lengthInDots,
      cmd.color,
      // A line is just a box filled in!
      Math.min(cmd.heightInDots, cmd.lengthInDots)
    );
  }

  private addBoxCommand(
    cmd: Commands.AddBoxCommand,
    outDoc: Commands.TranspiledDocumentState,
  ): string {
    return this.lineOrBoxToCmd(
      outDoc,
      cmd.heightInDots,
      cmd.lengthInDots,
      Commands.DrawColor.black,
      cmd.thickness
    );
  }

  private lineOrBoxToCmd(
    outDoc: Commands.TranspiledDocumentState,
    height: number,
    length: number,
    color: Commands.DrawColor,
    thickness?: number
  ): string {
    height = Math.trunc(height) || 0;
    length = Math.trunc(length) || 0;
    thickness = Math.trunc(thickness ?? 1) || 1;
    let drawMode: string;
    switch (color) {
      case Commands.DrawColor.black:
        drawMode = 'B';
        break;
      case Commands.DrawColor.white:
        drawMode = 'W';
        break;
    }
    const fieldStart = this.getFieldOffsetCommand(outDoc);

    // TODO: Support rounding?
    return [fieldStart, `^GB${length}`, height, thickness, drawMode, '^FS'].join(',');
  }
}
