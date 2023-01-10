import * as Commands from './Commands.js';
import { DocumentBuilder } from './Document.js';
import * as Options from '../Printers/Configuration/PrinterOptions.js';
import { BitmapGRF, ImageConversionOptions } from './BitmapGRF.js';

export interface ILabelDocumentBuilder
    extends DocumentBuilder<ILabelDocumentBuilder>,
        ILabelActionCommandBuilder,
        ILabelPositionCommandBuilder,
        ILabelContentCommandBuilder {}

export class LabelDocumentBuilder
    extends DocumentBuilder<ILabelDocumentBuilder>
    implements ILabelDocumentBuilder
{
    // TOOD: Implement other document types, such as stored forms, with type safety
    // so that only certain commands can be used on them.
    // Maybe different types??
    private _docType: LabelDocumentType = LabelDocumentType.instanceForm;

    get commandReorderBehavior(): Commands.CommandReorderBehavior {
        return Commands.CommandReorderBehavior.none;
    }

    constructor(
        config: Options.PrinterOptions,
        docType: LabelDocumentType = LabelDocumentType.instanceForm
    ) {
        super(config);
        this._docType = docType;
    }

    ///////////////////// GENERAL LABEL HANDLING

    clearImageBuffer(): ILabelDocumentBuilder {
        return this.andThen(new Commands.ClearImageBufferCommand());
    }

    addPrintCmd(count?: number, additionalDuplicateOfEach?: number): ILabelDocumentBuilder {
        return this.andThen(new Commands.PrintCommand(count ?? 1, additionalDuplicateOfEach ?? 0));
    }

    addCutNowCommand(): ILabelDocumentBuilder {
        return this.andThen(new Commands.CutNowCommand());
    }

    startNewLabel(): ILabelDocumentBuilder {
        return this.andThen(new Commands.NewLabelCommand());
    }

    suppressFeedBackupForLabel(): ILabelDocumentBuilder {
        return this.andThen(new Commands.SuppressFeedBackupCommand());
    }

    reenableFeedBackup(): ILabelDocumentBuilder {
        return this.andThen(new Commands.EnableFeedBackupCommand());
    }

    ///////////////////// OFFSET AND SPACING

    setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
        return this.andThen(new Commands.OffsetCommand(horizontal, vertical, true));
    }

    setLabelHomeOffsetDots(horizontalOffsetInDots: number, verticalOffsetInDots: number) {
        return this.andThen(
            new Commands.SetLabelHomeCommand(horizontalOffsetInDots, verticalOffsetInDots)
        );
    }

    addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
        return this.andThen(new Commands.OffsetCommand(horizontal, vertical));
    }

    resetOffset(): ILabelDocumentBuilder {
        return this.andThen(new Commands.OffsetCommand(0, 0, true));
    }

    ///////////////////// LABEL IMAGE CONTENTS

    addImageFromImageData(
        imageData: ImageData,
        imageConversionOptions: ImageConversionOptions = {}
    ): ILabelDocumentBuilder {
        return this.andThen(
            new Commands.AddImageCommand(
                BitmapGRF.fromCanvasImageData(imageData),
                imageConversionOptions
            )
        );
    }

    addImageFromGRF(
        image: BitmapGRF,
        imageConversionOptions: ImageConversionOptions = {}
    ): ILabelDocumentBuilder {
        return this.andThen(new Commands.AddImageCommand(image, imageConversionOptions));
    }

    async addImageFromSVG(
        svg: string,
        widthInDots: number,
        heightInDots: number,
        imageConversionOptions: ImageConversionOptions = {}
    ): Promise<ILabelDocumentBuilder> {
        const img = await BitmapGRF.fromSVG(svg, widthInDots, heightInDots, imageConversionOptions);
        const result = this.addImageFromGRF(img, imageConversionOptions);
        return result;
    }

    addLine(lengthInDots: number, heightInDots: number, color = Commands.DrawColor.black) {
        return this.andThen(new Commands.AddLineCommand(lengthInDots, heightInDots, color));
    }

    addBox(
        lengthInDots: number,
        heightInDots: number,
        thicknessInDots: number
    ): ILabelDocumentBuilder {
        return this.andThen(
            new Commands.AddBoxCommand(lengthInDots, heightInDots, thicknessInDots)
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
        imageConversionOptions?: ImageConversionOptions
    ): ILabelDocumentBuilder;

    /** Add a bitmap GRF image to the label */
    addImageFromGRF(image: BitmapGRF): ILabelDocumentBuilder;

    /** Add an SVG image to the label, rendered to the given width and height. */
    addImageFromSVG(
        svg: string,
        widthInDots: number,
        heightInDots: number,
        imageConversionOptions?: ImageConversionOptions
    ): Promise<ILabelDocumentBuilder>;

    /** Draw a line from the current offset for the length and height. */
    addLine(
        lengthInDots: number,
        heightInDots: number,
        color?: Commands.DrawColor
    ): ILabelDocumentBuilder;

    /** Draw a box from the current offset. */
    addBox(
        lengthInDots: number,
        heightInDots: number,
        thicknessInDots: number
    ): ILabelDocumentBuilder;
}
