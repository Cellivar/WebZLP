import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Basic from './BasicCommands.js';
import { handleMessage } from './Messages.js';
import { cmdErrorReportingMapping } from './CmdErrorReporting.js';
import { getErrorMessage } from './ErrorMessage.js';
import { parseConfigResponse } from './CmdConfigurationInquiry.js';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends Cmds.StringCommandSet {
  override get documentStartPrefix() { return '\r\n'; };
  override get documentEndSuffix() { return '\r\n'; };

  constructor(
    extendedCommands: Cmds.IPrinterCommandMapping<string>[] = []
  ) {
    super(
      Conf.PrinterCommandLanguage.epl,
      handleMessage,
      {
        // Printer control
        NoOp: { commandType: 'NoOp' },
        CustomCommand: {
          commandType: 'CustomCommand',
          transpile: (c, d) => this.getExtendedCommand(c)(c, d, this)
        },
        Identify: {
          commandType: 'Identify',
          expand: () => [new Cmds.GetStatusCommand()],
        },
        RebootPrinter: {
          commandType: 'RebootPrinter',
          transpile: () => '^@\r\n',
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        Raw: {
          commandType: 'Raw',
          transpile: (c) => (c as Cmds.Raw).rawDocument,
        },
        GetStatus: {
          commandType: 'GetStatus',
          transpile: () => '\r\n^ee\r\n',
          readMessage: getErrorMessage,
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },

        // Configuration
        PrintConfiguration: {
          commandType: 'PrintConfiguration',
          transpile: () => `U\r\n`,
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        QueryConfiguration: {
          commandType: 'QueryConfiguration',
          transpile: () => 'UQ\r\n',
          readMessage: parseConfigResponse,
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        SaveCurrentConfiguration: {
          commandType: 'SaveCurrentConfiguration',
          // EPL doesn't have an explicit save step.
        },
        AutosenseMediaDimensions: {
          commandType: 'AutosenseMediaDimensions',
          transpile: () => 'xa\r\n',
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
          transpile: (c, d) => Basic.setLabelHomeCommand(c as Cmds.SetLabelHomeCommand, d),
        },
        SetLabelPrintOriginOffset: {
          commandType: 'SetLabelPrintOriginOffset',
          transpile: (c) => Basic.setLabelPrintOriginOffsetCommand(c as Cmds.SetLabelPrintOriginOffsetCommand),
        },
        SetMediaToContinuousMedia: {
          commandType: 'SetMediaToContinuousMedia',
          transpile: (c, d) => Basic.setLabelToContinuousMediaCommand(
            c as Cmds.SetMediaToContinuousMediaCommand,
            d.initialConfig,
          ),
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        SetMediaToWebGapMedia: {
          commandType: 'SetMediaToWebGapMedia',
          transpile: (c, d) => Basic.setLabelToWebGapMediaCommand(
            c as Cmds.SetMediaToWebGapMediaCommand,
            d.initialConfig,
          ),
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        SetMediaToMarkMedia: {
          commandType: 'SetMediaToMarkMedia',
          transpile: (c, d) => Basic.setLabelToMarkMediaCommand(
            c as Cmds.SetMediaToMarkMediaCommand,
            d.initialConfig,
          ),
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        SetPrintDirection: {
          commandType: 'SetPrintDirection',
          transpile: (c) => Basic.setPrintDirectionCommand((c as Cmds.SetPrintDirectionCommand).upsideDown),
        },
        SetPrintSpeed: {
          commandType: 'SetPrintSpeed',
          transpile: (c, d) => Basic.setPrintSpeedCommand(c as Cmds.SetPrintSpeedCommand, d),
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        SetBackfeedAfterTaken: {
          commandType: 'SetBackfeedAfterTaken',
          transpile: (c) => Basic.setBackfeedAfterTaken((c as Cmds.SetBackfeedAfterTakenMode).mode),
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
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
          transpile: () => '\r\nN\r\n',
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        EndLabel: {
          commandType: 'EndLabel',
          // No specific command, prints should have happened.
          transpile: () => '\r\n',
        },
        CutNow: {
          commandType: 'CutNow',
          transpile: () => 'C\r\n',
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
        },
        Print: {
          commandType: 'Print',
          transpile: (c) => Basic.printCommand(c as Cmds.PrintCommand),
        },
        ClearImageBuffer: {
          commandType: 'ClearImageBuffer',
          transpile: () => '\r\nN\r\n',
          formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
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
        cmdErrorReportingMapping,
        ...extendedCommands
      ]);
  }
}
