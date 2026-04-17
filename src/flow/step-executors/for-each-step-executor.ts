import { IStepExecution, IStepExecutor } from "../../contracts";
import { BreakLoopSignal } from "../control-signals";
import { ForEachStepDef } from "../step-defs";

export class ForEachStepExecutor implements IStepExecutor<ForEachStepDef> {
  async execute(stepExecution: IStepExecution<ForEachStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      const branchContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const branchExecution = runtime.createFlowExecution(
        stepDef.itemFlow,
        branchContext,
      );

      stepExecution.onStopRequested(() => branchExecution.requestStop());

      stepExecution.throwIfStopRequested();

      try {
        await branchExecution.start();
      } catch (error) {
        if (error instanceof BreakLoopSignal) {
          break;
        }

        throw error;
      }
    }
  }
}
