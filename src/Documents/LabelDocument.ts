import * as Commands from './Commands';
import { PrinterOptions } from '../Printers/Configuration/PrinterOptions';

export interface ILabelDocumentBuilder
    extends Commands.IDocumentBuilder,
        ILabelActionCommandBuilder,
        ILabelPositionCommandBuilder,
        ILabelContentCommandBuilder {}

export class LabelDocumentBuilder
    extends Commands.DocumentBuilder
    implements ILabelDocumentBuilder
{
    // TOOD: Implement other document types, such as stored forms, with type safety
    // so that only certain commands can be used on them.
    // Maybe different types??
    private _docType: LabelDocumentType = LabelDocumentType.instanceForm;

    constructor(
        config: PrinterOptions,
        docType: LabelDocumentType = LabelDocumentType.instanceForm
    ) {
        super(config);
        this._docType = docType;
    }

    then(command: Commands.IPrinterCommand): ILabelDocumentBuilder {
        super.then(command);
        return this;
    }

    ///////////////////// GENERAL LABEL HANDLING

    clearImageBuffer(): ILabelDocumentBuilder {
        return this.then(new Commands.ClearImageBufferCommand());
    }

    addPrintCmd(count?: number, additionalDuplicateOfEach?: number): ILabelDocumentBuilder {
        return this.then(new Commands.PrintCommand(count ?? 1, additionalDuplicateOfEach ?? 0));
    }

    addCutNowCommand(): ILabelDocumentBuilder {
        return this.then(new Commands.CutNowCommand());
    }

    startNewLabel(): ILabelDocumentBuilder {
        return this.then(new Commands.NewLabelCommand());
    }

    suppressFeedBackupForLabel(): ILabelDocumentBuilder {
        return this.then(new Commands.SuppressFeedBackupCommand());
    }

    reenableFeedBackup(): ILabelDocumentBuilder {
        return this.then(new Commands.EnableFeedBackupCommand());
    }

    ///////////////////// OFFSET AND SPACING

    setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
        return this.then(new Commands.Offset(horizontal, vertical, true));
    }

    addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
        return this.then(new Commands.Offset(horizontal, vertical));
    }

    resetOffset(): ILabelDocumentBuilder {
        return this.then(new Commands.Offset(0, 0, true));
    }

    ///////////////////// LABEL IMAGE CONTENTS

    addImage(
        imageData: ImageData,
        dithering = Commands.DitheringMethod.none
    ): ILabelDocumentBuilder {
        return this.then(new Commands.AddImageCommand(imageData, dithering));
    }

    addLine(lengthInDots: number, heightInDots: number, color = Commands.DrawColor.black) {
        return this.then(new Commands.AddLineCommand(lengthInDots, heightInDots, color));
    }

    addBox(
        lengthInDots: number,
        heightInDots: number,
        thicknessInDots: number
    ): ILabelDocumentBuilder {
        return this.then(new Commands.AddBoxCommand(lengthInDots, heightInDots, thicknessInDots));
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
    /** Set the aboslute offset from the top left position of the label. */
    setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder;

    /** Add a relative offset to the current offset from the top left position of the label. */
    addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder;

    /** Resets the offset back to origin (top left of label) */
    resetOffset(): ILabelDocumentBuilder;
}

export interface ILabelContentCommandBuilder {
    /** Add an ImageData object as an image to the label */
    addImage(imageData: ImageData, dithering?: Commands.DitheringMethod): ILabelDocumentBuilder;

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
