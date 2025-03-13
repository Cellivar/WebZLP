import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export function setBackfeedAfterTaken(
  mode: Conf.BackfeedAfterTaken
): string {
  if (mode === 'disabled') {
    // TODO: Does JC matter? It's only supported on 28X4
    // Send JB first for universal support and JC after just in case?
    return `JB\r\nJC\r\n`
  } else {
    // EPL doesn't support percentages so just turn it on.
    return `JF\r\n`;
  }
}

export function setPrintDirectionCommand(
  upsideDown: boolean
): string {
  const dir = upsideDown ? 'T' : 'B';
  return `Z${dir}` + '\r\n';
}

export function setDarknessCommand(
  cmd: Cmds.SetDarknessCommand,
  docState: Cmds.TranspiledDocumentState
): string {
  const percent = cmd.darknessPercent / 100.0;
  const dark = Math.ceil(percent * docState.initialConfig.maxMediaDarkness);
  return `D${dark}` + '\r\n';
}

export function setPrintSpeedCommand(
  cmd: Cmds.SetPrintSpeedCommand,
  docState: Cmds.TranspiledDocumentState
): string {
  const table = docState.initialConfig.speedTable;
  const printSpeed = table.toRawSpeed(cmd.speed);
  // Validation should have happened on setup, printer will just reject
  // invalid speeds.
  return `S${printSpeed}` + '\r\n';
}

export function setLabelDimensionsCommand(
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

export function setLabelHomeCommand(
  cmd: Cmds.SetLabelHomeCommand,
  outDoc: Cmds.TranspiledDocumentState
): string {
  Cmds.applyOffsetToDocState(
    new Cmds.OffsetCommand(cmd.offset.left, cmd.offset.top, true),
    outDoc
  );
  return '';
}

export function setLabelPrintOriginOffsetCommand(
  cmd: Cmds.SetLabelPrintOriginOffsetCommand,
): string {
  const xOffset = Math.trunc(cmd.offset.left);
  const yOffset = Math.trunc(cmd.offset.top);
  return `R${xOffset},${yOffset}` + '\r\n';
}

export function setLabelToContinuousMediaCommand(
  cmd: Cmds.SetMediaToContinuousMediaCommand,
  conf: Cmds.PrinterConfig,
): string {
  return setMediaTrackingMode(conf, {
    mode: 'continuous',
    formGapFeed: Util.clampToRange(Math.trunc(cmd.formGapInDots), 0, 65535),
  });
}

export function setLabelToWebGapMediaCommand(
  cmd: Cmds.SetMediaToWebGapMediaCommand,
  conf: Cmds.PrinterConfig,
): string {
  const length = Util.clampToRange(Math.trunc(cmd.mediaLengthInDots), 24, 65535);
  const minGap = conf.dpi === 300 ? 18 : 16;
  return setMediaTrackingMode(conf, {
    mode: 'web',
    length,
    gapLength: Util.clampToRange(Math.trunc(cmd.mediaGapInDots), minGap, 240),
    gapOffset: Util.clampToRange(Math.trunc(cmd.mediaGapOffsetInDots), 0, length),
  });
}

export function setLabelToMarkMediaCommand(
  cmd: Cmds.SetMediaToMarkMediaCommand,
  conf: Cmds.PrinterConfig,
): string {
  const length = Util.clampToRange(Math.trunc(cmd.mediaLengthInDots), 24, 65535);
  const minLine = conf.dpi === 300 ? 18 : 16;
  return setMediaTrackingMode(conf, {
    mode: 'mark',
    length,
    blackLength: Util.clampToRange(Math.trunc(cmd.blackLineThicknessInDots), minLine, 240),
    blackOffset: Util.clampToRange(Math.trunc(cmd.blackLineOffset), 0, length),
  });
}

export function setMediaTrackingMode(
  conf: Cmds.PrinterConfig,
  mode: {
    mode: 'web'
    length: number,
    gapLength: number,
    gapOffset: number,
  } | {
    mode: 'continuous'
    formGapFeed: number,
  } | {
    mode: 'mark',
    length: number,
    blackLength: number,
    blackOffset: number,
  }
) {
  switch (mode.mode) {
    case 'web': {
      // Length is the label length, marker is gap length
      // Marker offset is additional dots 'down' into the label. If a notch is
      // 4mm 'down' from the true edge then 4mm * 8 dots = 24 offset.
      // Q123,24+24
      const offset = mode.gapOffset === 0 ? '' : ('+' + mode.gapOffset);
      return `Q${mode.length},${mode.gapLength}${offset}\r\n` +
        setHardwareMode(conf, { reverseSensor: false });
    }
    case 'mark': {
      // Length is distance between black line marks.
      // Marker length is the length of the black line mark.
      // Marker offset is the distance from the end of the black mark to the
      // perforation point. Positive is 'down' into the black line, positive
      // is 'up' into the label.
      // TODO: validate that statement...
      // Q123,B24-156
      let offset = '';
      if (mode.blackOffset < 0) {
        offset = '-' + mode.blackOffset;
      } else if (mode.blackOffset > 0) {
        offset = '+' + mode.blackOffset;
      }
      return `Q${mode.length},B${mode.blackLength}${offset}\r\n` +
        setHardwareMode(conf, { reverseSensor: true });
    }
    case 'continuous':
      // Form length is variable, we just use the gap between forms.
      // Q24,0
      return `Q${mode.formGapFeed},0\r\n` +
        setHardwareMode(conf, { reverseSensor: false });
  }
}

export function setHardwareMode(
  config: Cmds.PrinterConfig,
  modify: {
    // TODO: Support C{num} batching
    cutter?: 'off' | 'on' | 'cmd',
    directThermal?: Conf.ThermalPrintMode,
    labelTaken?: boolean,
    reverseSensor?: boolean,
    feedButton?: Conf.FeedButtonMode
}) {
  // The EPL 'O' command is stateless, if you try to change one setting it resets
  // the other settings to defaults. To properly modify a setting you must supply
  // the other current settings too.
  // The parameters for this function are overrides, we default to current set
  // values from the printer for the rest.

  // Cutter - C, Cb, C{batch}
  let c = '';
  if (modify.cutter === undefined) {
    switch (config.mediaPrintMode) {
      case Conf.MediaPrintMode.cutter:
        c = 'C';
        break;
      case Conf.MediaPrintMode.cutterWaitForCommand:
        c = 'Cb';
        break;
    }
  } else if (modify.cutter === 'on') {
    c = 'C';
  } else if (modify.cutter === 'cmd') {
    c = 'Cb';
  }

  // Direct thermal - D, <blank>
  const directThermal = modify.directThermal ?? config.thermalPrintMode === Conf.ThermalPrintMode.direct;
  const d = directThermal ? 'D' : '';

  // Label taken sensor - P, <blank>
  const labelTaken = modify.labelTaken ?? (
    config.mediaPrintMode === Conf.MediaPrintMode.peel
    || config.mediaPrintMode === Conf.MediaPrintMode.peelWithPrePeel)
  let p = labelTaken ? 'P' : '';

  // Reverse sensor - S, <blank>
  const revSensor = modify.reverseSensor ?? config.mediaGapDetectMode === Conf.MediaMediaGapDetectionMode.markSensing;
  const s = revSensor ? 'S' : '';

  const feedButton = modify.feedButton ?? config.feedButtonMode;
  let l = '';
  let f = 'Ff';
  if (feedButton === 'disabled') {
    f = 'Fi';
  } else if (feedButton === 'tapToReprint') {
    f = 'Fr';
  } else if (feedButton === 'tapToPrint') {
    // Special mode, overrides label taken sensor too.
    p = '';
    l = 'L';
  }

  // Put it together in the correct order.
  // OCp1,D,P,L,S,F
  return 'O' + ([c, d, p, l, s, f].join(','));
}

export function printCommand(
  cmd: Cmds.PrintCommand,
): string {
  const total = Math.trunc(cmd.labelCount);
  const dup = Math.trunc(cmd.additionalDuplicateOfEach);
  return `P${total},${dup}` + '\r\n';
}

export function addImageCommand(
  cmd: Cmds.AddImageCommand,
  outDoc: Cmds.TranspiledDocumentState,
): string {
  // EPL only supports raw binary, get that.
  const bitmap = cmd.bitmap;
  const rawBitmap = bitmap.toBinaryGRF();
  const buffer = Util.DecodeAscii(rawBitmap);

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

export function addLineCommand(
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

export function addBoxCommand(
  cmd: Cmds.AddBoxCommand,
  outDoc: Cmds.TranspiledDocumentState,
): string {
  const length = Math.trunc(cmd.widthInDots) || 0;
  const height = Math.trunc(cmd.heightInDots) || 0;
  const thickness = Math.trunc(cmd.thickness) || 0;


  const params = [outDoc.horizontalOffset, outDoc.verticalOffset, thickness, length, height]
  return 'X' + params.join(',') + '\r\n';
}
