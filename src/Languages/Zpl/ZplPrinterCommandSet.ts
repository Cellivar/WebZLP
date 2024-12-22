import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { handleMessage } from './Messages.js';
import { CmdXmlQuery, cmdXmlQueryTypeMapping } from './CmdXmlQuery.js';
import { CmdHostIdentification, cmdHostIdentificationMapping } from './CmdHostIdentification.js';
import { cmdHostQueryMapping } from './CmdHostQuery.js';
import { CmdHostStatus, cmdHostStatusMapping } from './CmdHostStatus.js';
import { CmdHostConfig, cmdHostConfigMapping } from './CmdHostConfig.js';
import { CmdConfigUpdate, cmdConfigUpdateMapping } from './CmdConfigUpdate.js';

/** Command set for communicating with a ZPL II printer. */
export class ZplPrinterCommandSet extends Cmds.StringCommandSet {
  override get documentStartPrefix() { return '\n'; };
  override get documentEndSuffix() { return '\n'; };

  // ZPL is easier here as the prefixes are more consistent:
  // ~ means non-form command
  // ^ means form command
  // The pause commands have both versions just to make things fun!
  constructor(
    extendedCommands: Cmds.IPrinterCommandMapping<string>[] = []
  ) {
    super(
      Conf.PrinterCommandLanguage.zpl,
      {
        // Printer control
      NoOp: { commandType: 'NoOp' },
      CustomCommand: {
        commandType: 'CustomCommand',
        transpile: (c, d) => this.getExtendedCommand(c)(c, d, this)
      },
      Identify: {
        commandType: 'Identify',
        expand: () => [new CmdHostIdentification()],
      },
      RebootPrinter: {
        commandType: 'RebootPrinter',
        transpile: () => '~JR\n',
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },
      Raw: {
        commandType: 'Raw',
        transpile: (c) => (c as Cmds.Raw).rawDocument,
      },
      GetStatus: {
        commandType: 'GetStatus',
        expand: () => [new CmdHostStatus()],
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },

      // Configuration
      PrintConfiguration: {
        commandType: 'PrintConfiguration',
        transpile: () =>'~WC\n',
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },
      QueryConfiguration: {
        commandType: 'QueryConfiguration',
        expand: () => [
          new CmdXmlQuery('All'),
          new CmdHostConfig(),
        ],
      },
      SaveCurrentConfiguration: {
        commandType: 'SaveCurrentConfiguration',
        expand: () => [
          new Cmds.EndLabel(),
          new Cmds.StartLabel(),
          new CmdConfigUpdate('SaveCurrent'),
          new Cmds.EndLabel(),
        ],
      },
      AutosenseMediaDimensions: {
        commandType: 'AutosenseMediaDimensions',
        transpile: () => '~JC\n',
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },
      
      SetDarkness: {
        commandType: 'SetDarkness',
        transpile: (c, d) => this.setDarknessCommand(c as Cmds.SetDarknessCommand, d),
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },
      SetLabelDimensions: {
        commandType: 'SetLabelDimensions',
        transpile: (c) => this.setLabelDimensionsCommand(c as Cmds.SetLabelDimensionsCommand),
      },
      SetLabelHome: {
        commandType: 'SetLabelHome',
        transpile: (c) => this.setLabelHomeCommand(c as Cmds.SetLabelHomeCommand),
      },
      SetLabelPrintOriginOffset: {
        commandType: 'SetLabelPrintOriginOffset',
        transpile: (c) => this.setLabelPrintOriginOffsetCommand(c as Cmds.SetLabelPrintOriginOffsetCommand),
      },
      SetMediaToContinuousMedia: {
        commandType: 'SetMediaToContinuousMedia',
        transpile: (c) => this.setLabelToContinuousMediaCommand(c as Cmds.SetMediaToContinuousMediaCommand),
      },
      SetMediaToWebGapMedia: {
        commandType: 'SetMediaToWebGapMedia',
        transpile: (c) => this.setLabelToWebGapMediaCommand(c as Cmds.SetMediaToWebGapMediaCommand),
      },
      SetMediaToMarkMedia: {
        commandType: 'SetMediaToMarkMedia',
        transpile: (c) => this.setLabelToMarkMediaCommand(c as Cmds.SetMediaToMarkMediaCommand),
      },
      SetPrintDirection: {
        commandType: 'SetPrintDirection',
        transpile: (c) => this.setPrintDirectionCommand((c as Cmds.SetPrintDirectionCommand).upsideDown),
      },
      SetPrintSpeed: {
        commandType: 'SetPrintSpeed',
        transpile: (c, d) => this.setPrintSpeedCommand(c as Cmds.SetPrintSpeedCommand, d),
      },
      SetBackfeedAfterTaken: {
        commandType: 'SetBackfeedAfterTaken',
        transpile: (c) => this.setBackfeedAfterTaken((c as Cmds.SetBackfeedAfterTakenMode).mode),
      },

      // Media
      NewLabel: {
        commandType: 'NewLabel',
        expand: () => [
          new Cmds.EndLabel(),
          new Cmds.StartLabel()
        ],
      },
      StartLabel: {
        commandType: 'StartLabel',
        transpile: () => '\n' + '^XA',
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },
      EndLabel: {
        commandType: 'EndLabel',
        transpile: () => '^XZ' +'\n',
      },
      CutNow: {
        commandType: 'CutNow',
        // ZPL doesn't have an OOTB cut command except for one printer.
        // Cutter behavior should be managed by the ^MM command instead.
        formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
      },
      Print: {
        commandType: 'Print',
        transpile: (c) => this.printCommand(c as Cmds.PrintCommand),
      },
      ClearImageBuffer: {
        commandType: 'ClearImageBuffer',
        // Clear image buffer isn't a relevant command on ZPL printers.
        // Closest equivalent is the ~JP (pause and cancel) or ~JA (cancel all) but both
        // affect in-progress printing operations which is unlikely to be desired operation.
        // Translate as a no-op.
      },

      // Content
      AddBox: {
        commandType: 'AddBox',
        transpile: (c, d) => this.addBoxCommand(c as Cmds.AddBoxCommand, d),
      },
      AddImage: {
        commandType: 'AddImage',
        transpile: (c, d) => this.addImageCommand(c as Cmds.AddImageCommand, d),
      },
      AddLine: {
        commandType: 'AddLine',
        transpile: (c, d) => this.addLineCommand(c as Cmds.AddLineCommand, d),
      },
      Offset: {
        commandType: 'Offset',
        transpile: (c, d) => {
          Cmds.applyOffsetToDocState(c as Cmds.OffsetCommand, d);
          return this.noop;
        },
      },
    },
    [
      cmdConfigUpdateMapping,
      cmdHostConfigMapping,
      cmdXmlQueryTypeMapping,
      cmdHostIdentificationMapping,
      cmdHostQueryMapping,
      cmdHostStatusMapping,
      ...extendedCommands,
    ]
  );
  }

  public parseMessage<TReceived extends Conf.MessageArrayLike>(
    msg: TReceived,
    sentCommand?: Cmds.IPrinterCommand
  ): Cmds.IMessageHandlerResult<TReceived> {
    return handleMessage(this, msg, sentCommand);
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

  private setBackfeedAfterTaken(
    mode: Conf.BackfeedAfterTaken
  ) {
    // ZPL has special names for some percentages because of course it does.
    switch (mode) {
      case 'disabled': return '~JSO';
      case '100'     : return '~JSA';
      case '90'      : return '~JSN';
      case '0'       : return '~JSB';
      default        : return `~JS${mode}`;
    }
  }

  private setDarknessCommand(
    cmd: Cmds.SetDarknessCommand,
    docState: Cmds.TranspiledDocumentState
  ) {
    const percent = cmd.darknessPercent / 100.0;
    const dark = Math.trunc(Math.ceil(
      percent * docState.initialConfig.maxMediaDarkness
    ));
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

    if (cmd.setsLength && cmd.lengthInDots !== undefined) {
      outCmd += this.setLengthCommand(cmd.lengthInDots);
    }

    return outCmd;
  }

  private setLengthCommand(length: number) {
    const len = Util.clampToRange(Math.trunc(length), 1, 32000);
    return `^LL${len}^ML${(len * 2) + 100}`;
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
    cmd: Cmds.SetMediaToContinuousMediaCommand
  ): string {
    const length = Util.clampToRange(Math.trunc(cmd.mediaLengthInDots), 1, 32000);
    const gap    = Util.clampToRange(Math.trunc(cmd.formGapInDots), 0, 2000);
    return '^MNN' + this.setLengthCommand(length + gap);
  }

  private setLabelToWebGapMediaCommand(
    cmd: Cmds.SetMediaToWebGapMediaCommand
  ): string {
    return '^MNY' + this.setLengthCommand(cmd.mediaLengthInDots);
  }

  private setLabelToMarkMediaCommand(
    cmd: Cmds.SetMediaToMarkMediaCommand
  ): string {
    return '^MNM' + this.setLengthCommand(cmd.mediaLengthInDots);
  }

  private printCommand(
    cmd: Cmds.PrintCommand
  ): string {
    // TODO: Make sure this actually works this way..
    // According to the docs the first parameter is "total" labels,
    // while the third is duplicates.
    const total = Math.trunc(cmd.labelCount * (cmd.additionalDuplicateOfEach + 1));
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    // Add a single space character to ensure blank labels print too.
    return `^FD ^PQ${total},0,${dup}`;
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
