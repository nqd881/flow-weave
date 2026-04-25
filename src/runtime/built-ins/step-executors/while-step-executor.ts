import { IStepExecution, IStepExecutor } from "../../../contracts";
import { WhileStepDef } from "../../../flow/step-defs";
import { BreakLoopSignal } from "../../execution-signals";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class WhileStepExecutor implements IStepExecutor<WhileStepDef> {
  async execute(stepExecution: IStepExecution<WhileStepDef>): Promise<any> {
    const { stepDef, context } = stepExecution;

    while (await stepDef.condition(context)) {
      const iterationCtx = stepDef.adapt
        ? await stepDef.adapt(context)
        : context;

      const iterationExecution = stepExecution.createChildFlowExecution(
        stepDef.iterationFlow,
        iterationCtx,
      );

      throwIfStopRequested(stepExecution);

      try {
        await iterationExecution.start();
      } catch (error) {
        if (error instanceof BreakLoopSignal) {
          break;
        }

        throw error;
      }
    }
  }
}
