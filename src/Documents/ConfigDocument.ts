import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import * as Cmds from '../Commands/index.js';
import { type IDocument, DocumentBuilder } from './Document.js';

/** A series of printer commands that results in configuration changes. */
export interface IConfigDocumentBuilder
  extends DocumentBuilder<IConfigDocumentBuilder>,
  IPrinterBasicCommandBuilder,
  IPrinterConfigBuilder,
  IPrinterLabelConfigBuilder { }

/** Builder to generate a configuration to apply to a printer. */
export class ConfigDocumentBuilder
  extends DocumentBuilder<IConfigDocumentBuilder>
  implements IConfigDocumentBuilder {
  get commandReorderBehavior() {
    return Cmds.CommandReorderBehavior.afterAllForms;
  }

  constructor(config?: Cmds.PrinterConfig) {
    super(config ?? new Cmds.PrinterConfig());
  }

  // The config document appends an additional command to the end of the document
  // to commit the changes to stored memory. EPL does this automatically, ZPL does not
  // so to bring them closer to parity this is automatically implied.
  private _doSave = false;
  override finalize() {
    if (this._doSave) {
      this.andThen(new Cmds.SaveCurrentConfigurationCommand())
        .andThen(new Cmds.EndLabel())
        .andThen(new Cmds.StartLabel())
        .andThen(new Cmds.QueryConfigurationCommand());
    }
    return super.finalize();
  }

  ///////////////////// GENERAL LABEL HANDLING

  clearImageBuffer(): IConfigDocumentBuilder {
    return this.andThen(new Cmds.ClearImageBufferCommand());
  }

  rebootPrinter(): IDocument {
    this._doSave = false;
    return this.andThen(new Cmds.RebootPrinterCommand()).finalize();
  }

  ///////////////////// CONFIG READING

  queryConfiguration(): IConfigDocumentBuilder {
    return this.andThen(new Cmds.QueryConfigurationCommand());
  }

  printConfiguration(): IConfigDocumentBuilder {
    return this.andThen(new Cmds.PrintConfigurationCommand());
  }

  queryStatus(): IConfigDocumentBuilder {
    return this.andThen(new Cmds.GetStatusCommand());
  }

  ///////////////////// ALTER PRINTER CONFIG

  setDarknessConfig(darknessPercent: Conf.DarknessPercent) {
    this._doSave = true;
    return this.andThen(
      new Cmds.SetDarknessCommand(darknessPercent)
    );
  }

  setPrintDirection(upsideDown = false) {
    this._doSave = true;
    return this.andThen(new Cmds.SetPrintDirectionCommand(upsideDown));
  }

  setPrintSpeed(speed: Conf.PrintSpeed, mediaSlewSpeed = Conf.PrintSpeed.ipsAuto) {
    this._doSave = true;
    if (!this._config.speedTable.isValid(speed)) {
      throw new UnsupportedPrinterConfigError(
        'setPrintSpeed',
        `Print speed ${Conf.PrintSpeed[speed]} is not valid for model ${this._config.model}`
      );
    }

    // If the media slew speed is auto just copy the print speed.
    if (mediaSlewSpeed === Conf.PrintSpeed.ipsAuto) {
      mediaSlewSpeed = speed;
    }
    if (mediaSlewSpeed && !this._config.speedTable.isValid(mediaSlewSpeed)) {
      throw new UnsupportedPrinterConfigError(
        'setPrintSpeed',
        `Media slew speed ${Conf.PrintSpeed[speed]} is not valid for model ${this._config.model}`
      );
    }

    return this.andThen(
      new Cmds.SetPrintSpeedCommand(
        speed,
        mediaSlewSpeed
      )
    );
  }

  ///////////////////// ALTER LABEL CONFIG

  autosenseLabelLength() {
    return this.andThen(new Cmds.AutosenseMediaDimensionsCommand()).finalize();
  }

  setBackfeedAfterTakenMode(mode: Conf.BackfeedAfterTaken) {
    return this.andThen(new Cmds.SetBackfeedAfterTakenMode(mode));
  }

  setLabelDimensions(widthInInches: number, lengthInInches?: number, gapLengthInInches?: number) {
    this._doSave = true;
    const dpi = this._config.dpi;
    return this.setLabelDimensionsDots(
      widthInInches * dpi,
      lengthInInches ? lengthInInches * dpi : undefined,
      gapLengthInInches ? gapLengthInInches * dpi : undefined
    );
  }

  setLabelDimensionsDots(widthInDots: number, lengthInDots?: number, gapLengthInDots?: number) {
    this._doSave = true;
    return this.andThen(
      new Cmds.SetLabelDimensionsCommand(widthInDots, lengthInDots, gapLengthInDots)
    );
  }

  setLabelHomeOffsetDots(horizontalOffsetInDots: number, verticalOffsetInDots: number) {
    this._doSave = true;
    return this.andThen(
      new Cmds.SetLabelHomeCommand({
        left: horizontalOffsetInDots,
        top: verticalOffsetInDots
      })
    );
  }

  setLabelPrintOriginOffsetCommand(horizontalOffsetInDots: number, verticalOffsetInDots: number) {
    this._doSave = true;
    return this.andThen(
      new Cmds.SetLabelPrintOriginOffsetCommand({
        left: horizontalOffsetInDots,
        top: verticalOffsetInDots
      })
    );
  }

  setLabelMediaToContinuous(
    mediaLengthInInches: number,
    formGapInInches: number = 0,
  ): IConfigDocumentBuilder {
    this._doSave = true;
    const dpi = this._config.dpi;
    return this.andThen(
      new Cmds.SetMediaToContinuousMediaCommand(
        dpi * mediaLengthInInches,
        dpi * formGapInInches
      )
    );
  }

  setLabelMediaToWebGapSense(
    labelLengthInInches: number,
    labelGapInInches: number
  ): IConfigDocumentBuilder {
    this._doSave = true;
    const dpi = this._config.dpi;
    return this.andThen(
      new Cmds.SetMediaToWebGapMediaCommand(
        labelLengthInInches * dpi,
        labelGapInInches * dpi
      )
    );
  }

  setLabelMediaToMarkSense(
    labelLengthInInches: number,
    blackLineThicknessInInches: number,
    blackLineOffsetInInches: number
  ): IConfigDocumentBuilder {
    this._doSave = true;
    const dpi = this._config.dpi;
    return this.andThen(
      new Cmds.SetMediaToMarkMediaCommand(
        labelLengthInInches * dpi,
        blackLineThicknessInInches * dpi,
        blackLineOffsetInInches * dpi
      )
    );
  }
}

export interface IPrinterBasicCommandBuilder {
  /** Clear the image buffer and prepare for a new set of Cmds. */
  clearImageBuffer(): IConfigDocumentBuilder;

  /** Simulate turning the printer off and back on. Must be the final command. */
  rebootPrinter(): IDocument;

  /** Get any error messages from the printer. */
  queryStatus(): IConfigDocumentBuilder;
}

export interface IPrinterConfigBuilder {
  /** Query the printer for its config details. */
  queryConfiguration(): IConfigDocumentBuilder;

  /** Print the configuration directly on labels. Must be final command. */
  printConfiguration(): IConfigDocumentBuilder;
}

export interface IPrinterLabelConfigBuilder {
  /** Set the darkness of the printer in the stored configuration. */
  setDarknessConfig(darknessPercent: Conf.DarknessPercent): IConfigDocumentBuilder;

  /** Set the direction labels print out of the printer. */
  setPrintDirection(upsideDown?: boolean): IConfigDocumentBuilder;

  /** Set the speed at which the labels print. */
  setPrintSpeed(speed: Conf.PrintSpeed): IConfigDocumentBuilder;

  /**
   * Set the size of the labels in the printer.
   *
   * Omit length and gap if an autosense was or will be run. Both must be provided
   * to set the length and gap manually, otherwise the length will be ignored. This
   * is usually only necessary when using continuous media, see the documentation.
   *
   * Note that different printers often have slightly different values, copying
   * values between printers may have unintended effects.
   */
  setLabelDimensions(
    widthInInches: number,
    lengthInInches?: number,
    gapLengthInInches?: number
  ): IConfigDocumentBuilder;

  /**
   * Set the size of the labels in the printer, sized in dots. Dots are printer DPI specific.
   *
   * Omit length and gap if an autosense was or will be run. Both must be provided
   * to set the length and gap manually, otherwise the length will be ignored. This
   * is usually only necessary when using continuous media, see the documentation.
   *
   * Note that different printers often have slightly different values, copying
   * values between printers may have unintended effects.
   */
  setLabelDimensionsDots(
    widthInDots: number,
    lengthInDots?: number,
    gapLengthInDots?: number
  ): IConfigDocumentBuilder;

  /**
   * Sets the temporary origin offset from the top-left of the label that all
   * other offsets are calculated from. Only applies to current label.
   *
   * Use this to fine-tune the alignment of your printer to your label stock.
   *
   * Avoid printing off the edges of a label, which can cause excessive head wear.
   */
  setLabelHomeOffsetDots(
    horizontalOffsetInDots: number,
    verticalOffsetInDots: number
  ): IConfigDocumentBuilder;

  /** Sets the retained origin offset from the top-left of the label that all
   * other offets are calculated from. Applies to all labels until a printer reset
   * or power cycle.
   *
   * May or may not be stored depending on printer firmware.
   *
   * Avoid printing off the edges of a label, which can cause excessive head wear.
   */
  setLabelPrintOriginOffsetCommand(
    horizontalOffsetInDots: number,
    verticalOffsetInDots: number
  ): IConfigDocumentBuilder;

  /** Run the autosense operation to get label length. Must be last command. */
  autosenseLabelLength(): IDocument;

  /** Set the backfeed behavior after cut/take of label. */
  setBackfeedAfterTakenMode(mode: Conf.BackfeedAfterTaken): IConfigDocumentBuilder;

  /** Sets the media type to continuous (gapless) media. */
  setLabelMediaToContinuous(labelLengthInDots: number): IConfigDocumentBuilder;

  /** Sets the media type to web gap sensing media. It's recommended to run autosense after this. */
  setLabelMediaToWebGapSense(
    labelLengthInDots: number,
    labelGapInDots: number
  ): IConfigDocumentBuilder;

  /** Sets the media type to mark sensing media. */
  setLabelMediaToMarkSense(
    labelLengthInDots: number,
    blackLineThicknessInDots: number,
    blackLineOffset: number
  ): IConfigDocumentBuilder;
}

/** Error indicating setting a config value failed. */
export class UnsupportedPrinterConfigError extends Util.WebZlpError {
  constructor(settingName: string, settingError: string) {
    super(`Error setting ${settingName}: ${settingError}`);
    this.name = this.constructor.name;
    this.settingName = settingName;
    this.settingError = settingError;
  }

  settingName: string;
  settingError: string;
}
