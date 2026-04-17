import { IStepExecution, IStepExecutor } from "../../contracts";
import { BreakLoopSignal } from "../control-signals";
import { WhileStepDef } from "../step-defs";

export class WhileStepExecutor implements IStepExecutor<WhileStepDef> {
  async execute(stepExecution: IStepExecution<WhileStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    while (await stepDef.condition(context)) {
      const iterationCtx = stepDef.adapt
        ? await stepDef.adapt(context)
        : context;

      const iterationExecution = runtime.createFlowExecution(
        stepDef.iterationFlow,
        iterationCtx,
      );

      stepExecution.onStopRequested(() => iterationExecution.requestStop());

      stepExecution.throwIfStopRequested();

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
