import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Basic from './BasicCommands.js';
import { handleMessage } from './Messages.js';
import { CmdXmlQuery, cmdXmlQueryTypeMapping } from './CmdXmlQuery.js';
import { CmdHostIdentification, cmdHostIdentificationMapping } from './CmdHostIdentification.js';
import { cmdHostQueryMapping } from './CmdHostQuery.js';
import { CmdHostStatus, cmdHostStatusMapping } from './CmdHostStatus.js';
import { CmdHostConfig, cmdHostConfigMapping } from './CmdHostConfig.js';
import { CmdConfigUpdate, cmdConfigUpdateMapping } from './CmdConfigUpdate.js';
import { cmdGraphSensorCalibrationMapping } from './CmdGraphSensorCalibration.js';
import { cmdSetSensorCalibrationMapping } from './CmdSetSensorCalibration.js';
import { ZplPrinterConfig } from './Config.js';
import { cmdSetPowerUpAndHeadCloseActionMapping } from './CmdSetPowerUpAndHeadCloseAction.js';

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
      handleMessage,
      {
        NoOp: { commandType: 'NoOp' },
        CustomCommand: {
          commandType: 'CustomCommand',
          transpile: (c, d) => this.getExtendedCommand(c)(c, d, this)
        },
        // Printer control
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
          transpile: (c, d) => Basic.setDarknessCommand(c as Cmds.SetDarknessCommand, d),
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        SetLabelDimensions: {
          commandType: 'SetLabelDimensions',
          transpile: (c) => Basic.setLabelDimensionsCommand(c as Cmds.SetLabelDimensionsCommand),
        },
        SetLabelHome: {
          commandType: 'SetLabelHome',
          transpile: (c) => Basic.setLabelHomeCommand(c as Cmds.SetLabelHomeCommand),
        },
        SetLabelPrintOriginOffset: {
          commandType: 'SetLabelPrintOriginOffset',
          transpile: (c) => Basic.setLabelPrintOriginOffsetCommand(c as Cmds.SetLabelPrintOriginOffsetCommand),
        },
        SetMediaToContinuousMedia: {
          commandType: 'SetMediaToContinuousMedia',
          transpile: (c) => Basic.setLabelToContinuousMediaCommand(c as Cmds.SetMediaToContinuousMediaCommand),
        },
        SetMediaToWebGapMedia: {
          commandType: 'SetMediaToWebGapMedia',
          transpile: (c) => Basic.setLabelToWebGapMediaCommand(c as Cmds.SetMediaToWebGapMediaCommand),
        },
        SetMediaToMarkMedia: {
          commandType: 'SetMediaToMarkMedia',
          transpile: (c) => Basic.setLabelToMarkMediaCommand(c as Cmds.SetMediaToMarkMediaCommand),
        },
        SetPrintDirection: {
          commandType: 'SetPrintDirection',
          transpile: (c) => Basic.setPrintDirectionCommand((c as Cmds.SetPrintDirectionCommand).upsideDown),
        },
        SetPrintSpeed: {
          commandType: 'SetPrintSpeed',
          transpile: (c, d) => Basic.setPrintSpeedCommand(c as Cmds.SetPrintSpeedCommand, d),
        },
        SetBackfeedAfterTaken: {
          commandType: 'SetBackfeedAfterTaken',
          transpile: (c) => Basic.setBackfeedAfterTaken((c as Cmds.SetBackfeedAfterTakenMode).mode),
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
          transpile: (c) => Basic.printCommand(c as Cmds.PrintCommand),
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
          transpile: (c, d) => Basic.addBoxCommand(c as Cmds.AddBoxCommand, d),
        },
        AddImage: {
          commandType: 'AddImage',
          transpile: (c, d) => Basic.addImageCommand(c as Cmds.AddImageCommand, d),
        },
        AddLine: {
          commandType: 'AddLine',
          transpile: (c, d) => Basic.addLineCommand(c as Cmds.AddLineCommand, d),
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
        cmdSetPowerUpAndHeadCloseActionMapping,
        cmdGraphSensorCalibrationMapping,
        cmdSetSensorCalibrationMapping,
        ...extendedCommands,
      ]
    );
  }

  public override getConfig(config: Cmds.PrinterConfig) {
    return new ZplPrinterConfig(config);
  }
}
