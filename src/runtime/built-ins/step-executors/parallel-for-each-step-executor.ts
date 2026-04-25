import { IFlowExecution, IStepExecution, IStepExecutor } from "../../../contracts";
import { ParallelForEachStepDef } from "../../../flow/step-defs";
import { coordinateParallelExecutions } from "../../execution/parallel-execution-utils";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class ParallelForEachStepExecutor implements IStepExecutor<ParallelForEachStepDef> {
  async execute(
    stepExecution: IStepExecution<ParallelForEachStepDef>,
  ): Promise<any> {
    const { stepDef, context } = stepExecution;

    const itemExecutions: IFlowExecution[] = [];

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      const itemContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const itemExecution = stepExecution.createChildFlowExecution(
        stepDef.itemFlow,
        itemContext,
      );

      itemExecutions.push(itemExecution);
    }

    if (!itemExecutions.length) {
      return;
    }

    throwIfStopRequested(stepExecution);

    await coordinateParallelExecutions(itemExecutions, stepDef.strategy);
  }
}
