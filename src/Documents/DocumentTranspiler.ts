import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import * as Cmds from '../Commands/index.js';
import { CompiledDocument, Transaction, type IDocument } from './Document.js';

type PrecompiledTransaction = {
  commands: Cmds.IPrinterCommand[];
  waitCommand?: Cmds.IPrinterCommand;
};

interface RawCommandForm {
  effects: Cmds.CommandEffectFlags;
  transactions: PrecompiledTransaction[];
  withinForm: boolean;
}

export function transpileDocument(
  doc: IDocument,
  commandSet: Cmds.CommandSet<Conf.MessageArrayLike>,
  documentMetadata: Cmds.TranspiledDocumentState,
  commandReorderBehavior: Cmds.CommandReorderBehavior = Cmds.CommandReorderBehavior.afterAllForms
): Readonly<CompiledDocument> {

  const cmdsWithinDoc = [
    ...commandSet.documentStartCommands,
    ...doc.commands,
    ...commandSet.documentEndCommands,
  ];
  const forms = splitTransactionsAndForms(cmdsWithinDoc, commandSet, commandReorderBehavior);

  // Wait why do we throw away the form data here?
  // ZPL has some advanced form processing concepts that aren't implemented in
  // this library yet, and that code was annoying to figure out. It hangs out
  // here until the advanced form processing can be implemented later.
  // TODO: Handle separate forms instead of mooshing them together.
  const { transactions, effects } = combineForms(forms);

  const commandsWithMaybeErrors = transactions
    .map((trans) => compileTransaction(trans, commandSet, documentMetadata));

  const errs = commandsWithMaybeErrors.flatMap(ce => ce.errors);
  if (errs.length > 0) {
    throw new Cmds.TranspileDocumentError(
      'One or more validation errors occurred transpiling the document.',
      errs
    );
  }

  return Object.freeze(
    new CompiledDocument(
      commandSet.commandLanguage,
      effects,
      commandsWithMaybeErrors.map(c => c.transaction)
    )
  );
}

function splitTransactionsAndForms(
  commands: ReadonlyArray<Cmds.IPrinterCommand>,
  commandSet: Cmds.CommandSet<Conf.MessageArrayLike>,
  reorderBehavior: Cmds.CommandReorderBehavior
): RawCommandForm[] {
  const forms: Array<RawCommandForm> = [];
  const reorderedCommands: Array<Cmds.IPrinterCommand> = [];

  let currentTrans: Cmds.IPrinterCommand[] = [];
  let currentForm: RawCommandForm = {
    transactions: [],
    withinForm: false,
    effects: new Cmds.CommandEffectFlags(),
  }

  // We may need to add new commands while iterating, create a stack.
  const commandStack = commands.toReversed();

  do {
    const command = commandStack.pop();
    if (command === undefined) { continue; }

    // Determine if this command needs to be substituted for others.
    const yetMoreCommands = commandSet.expandCommand(command);
    if (yetMoreCommands.length > 0) {
      // The command set gave us fun new commands to deal with instead of the
      // current one. Add those to the stack and drop the current one.
      yetMoreCommands.toReversed().map(c => commandStack.push(c));
      continue;
    }

    // Non-form commands can't execute within a form, so we respect the command
    // reorder behavior and move the command accordingly.
    if (commandSet.isCommandNonFormCommand(command)) {
      switch (reorderBehavior) {
        default:
          Util.exhaustiveMatchGuard(reorderBehavior);
          break;
        case Cmds.CommandReorderBehavior.afterAllForms:
        case Cmds.CommandReorderBehavior.beforeAllForms:
          reorderedCommands.push(command);
          continue;
        case Cmds.CommandReorderBehavior.closeForm:
          if (currentForm.withinForm) {
            // The label wasn't closed so we must do it ourselves. Add a command
            // to close the label on the stack and send it back around.
            commandStack.push(command);
            commandStack.push(new Cmds.EndLabel());
            continue;
          }
          break;
        case Cmds.CommandReorderBehavior.throwError:
          if (currentForm.withinForm) {
            throw new Cmds.TranspileDocumentError("Non-form command present within a document form and Command Reorder Behavior was set to throw errors.");
          }
          break;
      }
    } else if (command.type === "StartLabel") {
      currentForm.withinForm = true;
    } else if (!currentForm.withinForm) {
      // It's a form command outside of a form and not a new form command.
      // Add an implicit new form command and send it back around.
      commandStack.push(command);
      commandStack.push(new Cmds.StartLabel());
      continue;
    }

    // Record the command in the transpile buffer.
    currentTrans.push(command);
    command.effectFlags.forEach(f => currentForm.effects.add(f));

    if (command.effectFlags.has("waitsForResponse")) {
      // This command expects the printer to provide feedback. We should pause
      // sending more commands until we get its response, which could take some
      // amount of time.
      // This is the end of our transaction.
      currentForm.transactions.push({
        commands: currentTrans,
        waitCommand: command,
      });
      currentTrans = [];
    }

    if (command.type === "EndLabel") {
      if (currentTrans.length > 0) {
        currentForm.transactions.push({ commands: currentTrans} );
        currentTrans = [];
      }
      forms.push(currentForm);
      currentForm = {
        transactions: [],
        withinForm: false,
        effects: new Cmds.CommandEffectFlags(),
      }
    }

    // If we're about to close up shop because this is the last command let's
    // check a few bookkeeping items are in order.
    if (commandStack.length === 0) {
      // If we didn't close out the current form we should now.
      if (currentForm.withinForm) {
        commandStack.push(new Cmds.EndLabel());
        continue;
      }
      // If we have commands in a transaction buffer close that too.
      if (currentTrans.length > 0) {
        currentForm.transactions.push({ commands: currentTrans} );
        currentTrans = [];
      }
      // And if the current form has any contents close it out.
      if (currentForm.transactions.length > 0) {
        forms.push(currentForm);
      }
    }
  } while (commandStack.length > 0)

  if (reorderedCommands.length > 0) {
    // The reordered commands should only be non-form commands, so it should be
    // safe to throw an error about it.
    const reorderedForms = splitTransactionsAndForms(
      reorderedCommands,
      commandSet,
      Cmds.CommandReorderBehavior.throwError);
    switch (reorderBehavior) {
      default:
        Util.exhaustiveMatchGuard(reorderBehavior);
        break;
      case Cmds.CommandReorderBehavior.beforeAllForms:
        reorderedForms.reverse().forEach(f => forms.unshift(f));
        break;
      case Cmds.CommandReorderBehavior.afterAllForms:
      case Cmds.CommandReorderBehavior.closeForm:
      case Cmds.CommandReorderBehavior.throwError:
        reorderedForms.forEach(f => forms.push(f));
        break;
    }
  }

  return forms;
}

function compileTransaction(
  trans: PrecompiledTransaction,
  commandSet: Cmds.CommandSet<Conf.MessageArrayLike>,
  docState: Cmds.TranspiledDocumentState,
): {
  transaction: Transaction,
  errors: Cmds.TranspileDocumentError[]
} {
  const {cmds, errors} = trans.commands
    .map((cmd) => commandSet.transpileCommand(cmd, docState))
    .reduce((a, cmd) => {
      if (cmd instanceof Cmds.TranspileDocumentError) {
        a.errors.push(cmd);
      } else {
        a.cmds.push(cmd);
      }
      return a;
    }, {
      cmds: new Array<Conf.MessageArrayLike>,
      errors: new Array<Cmds.TranspileDocumentError>,
    });

  return {
    transaction: new Transaction(
      commandSet.combineCommands(...cmds),
      trans.waitCommand
    ),
    errors
  };
}

function combineForms(forms: RawCommandForm[]): RawCommandForm {
  const result: RawCommandForm = {
    transactions: [],
    withinForm: false,
    effects: new Cmds.CommandEffectFlags(),
  }

  forms.forEach(f => {
    result.transactions.push(...f.transactions);
    f.effects.forEach(e => result.effects.add(e));
  });

  return result;
}
