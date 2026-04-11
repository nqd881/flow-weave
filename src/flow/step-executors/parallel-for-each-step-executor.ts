import { IFlowExecution, IStepExecution, IStepExecutor } from "../../contracts";
import { ParallelForEachStepDef } from "../step-defs";
import { ParallelStepStrategy } from "../types";
import { firstCompleted, mapStop } from "../utils";

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

    const itemStarts = itemExecutions.map((itemExecution) =>
      itemExecution.start(),
    );

    switch (stepDef.strategy) {
      case ParallelStepStrategy.FailFast: {
        await Promise.all(itemStarts).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.AllSettled: {
        await Promise.allSettled(itemStarts);
        break;
      }
      case ParallelStepStrategy.FirstSettled: {
        await Promise.race(itemStarts).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.FirstCompleted: {
        await firstCompleted(itemStarts);
        break;
      }
    }
  }
}
