import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export function getFieldOffsetCommand(
  formMetadata: Cmds.TranspiledDocumentState,
  additionalHorizontal = 0,
  additionalVertical = 0
) {
  const xOffset = Math.trunc(formMetadata.horizontalOffset + additionalHorizontal);
  const yOffset = Math.trunc(formMetadata.verticalOffset + additionalVertical);
  return `^FO${xOffset},${yOffset}`;
}

export function addImageCommand(
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
  const fieldStart = getFieldOffsetCommand(
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

export function setPrintDirectionCommand(upsideDown: boolean) {
  const dir = upsideDown ? 'I' : 'N';
  return `^PO${dir}`;
}

export function setBackfeedAfterTaken(
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

export function setDarknessCommand(
  cmd: Cmds.SetDarknessCommand,
  docState: Cmds.TranspiledDocumentState
) {
  const percent = cmd.darknessPercent / 100.0;
  const dark = Math.trunc(Math.ceil(
    percent * docState.initialConfig.maxMediaDarkness
  ));
  return `~SD${dark}`;
}

export function setPrintSpeedCommand(
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

export function setLabelDimensionsCommand(cmd: Cmds.SetLabelDimensionsCommand) {
  const width = Math.trunc(cmd.widthInDots);
  let outCmd = `^PW${width}`;

  if (cmd.setsLength && cmd.lengthInDots !== undefined) {
    outCmd += setLengthCommand(cmd.lengthInDots);
  }

  return outCmd;
}

export function setLengthCommand(length: number) {
  const len = Util.clampToRange(Math.trunc(length), 1, 32000);
  return `^LL${len}^ML${(len * 2) + 100}`;
}

export function setLabelHomeCommand(cmd: Cmds.SetLabelHomeCommand) {
  const xOffset = Math.trunc(cmd.offset.left);
  const yOffset = Math.trunc(cmd.offset.top);
  return `^LH${xOffset},${yOffset}`;
}

export function setLabelPrintOriginOffsetCommand(
  cmd: Cmds.SetLabelPrintOriginOffsetCommand
): string {
  // This ends up being two commands, one to set the top and one to set the
  // horizontal shift. LS moves the horizontal, LT moves the top. LT is
  // clamped to +/- 120 dots, horizontal is 9999.
  const xOffset = Util.clampToRange(Math.trunc(cmd.offset.left), -9999, 9999);
  const yOffset = Util.clampToRange(Math.trunc(cmd.offset.top), -120, 120);
  return `^LS${xOffset}^LT${yOffset}`;
}

export function setLabelToContinuousMediaCommand(
  cmd: Cmds.SetMediaToContinuousMediaCommand
): string {
  const length = Util.clampToRange(Math.trunc(cmd.mediaLengthInDots), 1, 32000);
  const gap    = Util.clampToRange(Math.trunc(cmd.formGapInDots), 0, 2000);
  return '^MNN' + setLengthCommand(length + gap);
}

export function setLabelToWebGapMediaCommand(
  cmd: Cmds.SetMediaToWebGapMediaCommand
): string {
  return '^MNY' + setLengthCommand(cmd.mediaLengthInDots);
}

export function setLabelToMarkMediaCommand(
  cmd: Cmds.SetMediaToMarkMediaCommand
): string {
  return '^MNM' + setLengthCommand(cmd.mediaLengthInDots);
}

export function printCommand(
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

export function addLineCommand(
  cmd: Cmds.AddLineCommand,
  outDoc: Cmds.TranspiledDocumentState
): string {
  return lineOrBoxToCmd(
    outDoc,
    cmd.heightInDots,
    cmd.widthInDots,
    cmd.color,
    // A line is just a box filled in!
    Math.min(cmd.heightInDots, cmd.widthInDots)
  );
}

export function addBoxCommand(
  cmd: Cmds.AddBoxCommand,
  outDoc: Cmds.TranspiledDocumentState,
): string {
  return lineOrBoxToCmd(
    outDoc,
    cmd.heightInDots,
    cmd.widthInDots,
    Cmds.DrawColor.black,
    cmd.thickness
  );
}

export function lineOrBoxToCmd(
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
  const fieldStart = getFieldOffsetCommand(outDoc);

  // TODO: Support rounding?
  return [fieldStart, `^GB${length}`, height, thickness, drawMode, '^FS'].join(',');
}
