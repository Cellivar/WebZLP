import * as Util from '../Util/index.js';
import * as Cmds from '../Commands/index.js';
import { DocumentBuilder } from './Document.js';

export interface ILabelDocumentBuilder
  extends DocumentBuilder<ILabelDocumentBuilder>,
  ILabelActionCommandBuilder,
  ILabelPositionCommandBuilder,
  ILabelContentCommandBuilder { }

export class LabelDocumentBuilder
  extends DocumentBuilder<ILabelDocumentBuilder>
  implements ILabelDocumentBuilder {

  get commandReorderBehavior(): Cmds.CommandReorderBehavior {
    return Cmds.CommandReorderBehavior.closeForm;
  }

  constructor(
    config?: Cmds.PrinterConfig,
    // TODO: Implement other document types, such as stored forms, with type safety
    // so that only certain commands can be used on them.
    // Maybe different types??
    public readonly docType: LabelDocumentType = LabelDocumentType.instanceForm
  ) {
    super(config ?? new Cmds.PrinterConfig());
  }

  ///////////////////// GENERAL LABEL HANDLING

  clearImageBuffer(): ILabelDocumentBuilder {
    return this.andThen(new Cmds.ClearImageBufferCommand());
  }

  addPrintCmd(count?: number, additionalDuplicateOfEach?: number): ILabelDocumentBuilder {
    return this
      .andThen(new Cmds.PrintCommand(count ?? 1, additionalDuplicateOfEach ?? 0))
      .andThen(new Cmds.GetStatusCommand());
  }

  addCutNowCommand(): ILabelDocumentBuilder {
    return this.andThen(new Cmds.CutNowCommand());
  }

  startNewLabel(): ILabelDocumentBuilder {
    return this.andThen(new Cmds.EndLabel(), new Cmds.StartLabel());
  }

  suppressFeedBackupForLabel(): ILabelDocumentBuilder {
    return this.andThen(new Cmds.SuppressFeedBackupCommand());
  }

  reenableFeedBackup(): ILabelDocumentBuilder {
    return this.andThen(new Cmds.EnableFeedBackupCommand());
  }

  ///////////////////// OFFSET AND SPACING

  setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
    return this.andThen(new Cmds.OffsetCommand(horizontal, vertical, true));
  }

  setLabelHomeOffsetDots(horizontalOffsetInDots: number, verticalOffsetInDots: number) {
    return this.andThen(
      new Cmds.SetLabelHomeCommand({
        left: horizontalOffsetInDots,
        top: verticalOffsetInDots
      })
    );
  }

  addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
    return this.andThen(new Cmds.OffsetCommand(horizontal, vertical));
  }

  resetOffset(): ILabelDocumentBuilder {
    return this.andThen(new Cmds.OffsetCommand(0, 0, true));
  }

  ///////////////////// LABEL IMAGE CONTENTS

  addImageFromImageData(
    imageData: ImageData,
    imageConversionOptions: Util.ImageConversionOptions = {}
  ): ILabelDocumentBuilder {
    return this.andThen(
      new Cmds.AddImageCommand(
        Util.BitmapGRF.fromCanvasImageData(imageData),
        imageConversionOptions
      )
    );
  }

  addImageFromGRF(
    image: Util.BitmapGRF,
    imageConversionOptions: Util.ImageConversionOptions = {}
  ): ILabelDocumentBuilder {
    return this.andThen(new Cmds.AddImageCommand(image, imageConversionOptions));
  }

  async addImageFromSVG(
    svg: string,
    widthInDots: number,
    heightInDots: number,
    imageConversionOptions: Util.ImageConversionOptions = {}
  ): Promise<ILabelDocumentBuilder> {
    const img = await Util.BitmapGRF.fromSVG(svg, widthInDots, heightInDots, imageConversionOptions);
    const result = this.addImageFromGRF(img, imageConversionOptions);
    return result;
  }

  addLine(lengthInDots: number, heightInDots: number, color = Cmds.DrawColor.black) {
    return this.andThen(new Cmds.AddLineCommand(lengthInDots, heightInDots, color));
  }

  addBox(
    lengthInDots: number,
    heightInDots: number,
    thicknessInDots: number
  ): ILabelDocumentBuilder {
    return this.andThen(
      new Cmds.AddBoxCommand(lengthInDots, heightInDots, thicknessInDots)
    );
  }
}

/** Types of label documents to send to printers. See the docs. */
export enum LabelDocumentType {
  /** A form that is only used for one set of commands, then discarded. */
  instanceForm,
  /** A form that is stored in the printer to be re-used. */
  storedForm,
  /** A form that is rendered as an image before being sent to the printer. */
  imageForm
}

export interface ILabelActionCommandBuilder {
  /** Add a commant to print a number of the preceding label instructions. Defaults to 1 */
  addPrintCmd(count?: number, additionalDuplicateOfEach?: number): ILabelDocumentBuilder;

  /** Clear the image buffer to prepare for a new label. Usually only at the start of a label. */
  clearImageBuffer(): ILabelDocumentBuilder;

  /** Add a command to cut a label, usually at the end of a label and right before the print command. */
  addCutNowCommand(): ILabelDocumentBuilder;

  /** Begin a new label to be sent as a single batch. */
  startNewLabel(): ILabelDocumentBuilder;

  /** Disable feed backup for this label. Be sure to re-enable at the end of the batch. */
  suppressFeedBackupForLabel(): ILabelDocumentBuilder;

  /** Re-enable feed backup for this and future labels. */
  reenableFeedBackup(): ILabelDocumentBuilder;
}

export interface ILabelPositionCommandBuilder {
  /** Set the aboslute offset from the top left position of the label.
   *
   * Avoid printing off the edges of a label, which can cause excessive head wear.
   */
  setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder;

  /**
   * Sets the temporary origin offset from the top-left of the label that all
   * other offsets are calculated from. Only applies to current label.
   *
   * Avoid printing off the edges of a label, which can cause excessive head wear.
   */
  setLabelHomeOffsetDots(
    horizontalOffsetInDots: number,
    verticalOffsetInDots: number
  ): ILabelDocumentBuilder;

  /** Add a relative offset to the current offset from the top left position of the label.
   *
   * Avoid printing off the edges of a label, which can cause excessive head wear.
   */
  addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder;

  /** Resets the offset back to origin (top left of label) */
  resetOffset(): ILabelDocumentBuilder;
}

export interface ILabelContentCommandBuilder {
  /** Add an ImageData object as an image to the label */
  addImageFromImageData(
    imageData: ImageData,
    imageConversionOptions?: Util.ImageConversionOptions
  ): ILabelDocumentBuilder;

  /** Add a bitmap GRF image to the label */
  addImageFromGRF(image: Util.BitmapGRF): ILabelDocumentBuilder;

  /** Add an SVG image to the label, rendered to the given width and height. */
  addImageFromSVG(
    svg: string,
    widthInDots: number,
    heightInDots: number,
    imageConversionOptions?: Util.ImageConversionOptions
  ): Promise<ILabelDocumentBuilder>;

  /** Draw a line from the current offset for the length and height. */
  addLine(
    lengthInDots: number,
    heightInDots: number,
    color?: Cmds.DrawColor
  ): ILabelDocumentBuilder;

  /** Draw a box from the current offset. */
  addBox(
    lengthInDots: number,
    heightInDots: number,
    thicknessInDots: number
  ): ILabelDocumentBuilder;
}
