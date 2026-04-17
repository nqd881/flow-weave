import { IFlowExecution, IStepExecution, IStepExecutor } from "../../contracts";
import { ParallelForEachStepDef } from "../step-defs";
import { coordinateParallelExecutions } from "../parallel-execution-utils";

export class ParallelForEachStepExecutor implements IStepExecutor<ParallelForEachStepDef> {
  async execute(
    stepExecution: IStepExecution<ParallelForEachStepDef>,
  ): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    const itemExecutions: IFlowExecution[] = [];

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      const itemContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const itemExecution = runtime.createFlowExecution(
        stepDef.itemFlow,
        itemContext,
      );

      itemExecutions.push(itemExecution);
    }

    if (!itemExecutions.length) {
      return;
    }

    stepExecution.onStopRequested(() => {
      itemExecutions.forEach((itemExecution) => {
        itemExecution.requestStop();
      });
    });

    stepExecution.throwIfStopRequested();

    await coordinateParallelExecutions(itemExecutions, stepDef.strategy);
  }
}
