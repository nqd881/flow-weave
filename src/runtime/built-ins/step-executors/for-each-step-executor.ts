import { IStepExecution, IStepExecutor } from "../../../contracts";
import { ForEachStepDef } from "../../../flow/step-defs";
import { BreakLoopSignal } from "../../execution-signals";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class ForEachStepExecutor implements IStepExecutor<ForEachStepDef> {
  async execute(stepExecution: IStepExecution<ForEachStepDef>): Promise<any> {
    const { stepDef, context } = stepExecution;

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      const branchContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const branchExecution = stepExecution.createChildFlowExecution(
        stepDef.itemFlow,
        branchContext,
      );

      throwIfStopRequested(stepExecution);

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
