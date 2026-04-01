import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { ParallelForEachStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";
import { ParallelStepStrategy } from "../types";
import { firstCompleted, mapStop } from "../utils";

export class ParallelForEachStepExecutor implements IStepExecutor<ParallelForEachStepDef> {
  async execute(
    stepExecution: IStepExecution<ParallelForEachStepDef>,
  ): Promise<any> {
    const { client, stepDef, context } = stepExecution;

    const itemExecutions: IFlowExecution[] = [];

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      const itemContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const itemExecution = client.createFlowExecution(
        stepDef.itemFlow,
        itemContext,
      );

      itemExecutions.push(itemExecution);
    }

    stepExecution.onStopRequested(() => {
      itemExecutions.forEach((itemExecution) => {
        itemExecution.requestStop();
      });
    });

    this.ensureNotStopped(stepExecution);

    const startBranches = () =>
      itemExecutions.map((itemExecution) => itemExecution.start());

    switch (stepDef.strategy) {
      case ParallelStepStrategy.FailFast: {
        await Promise.all(startBranches()).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.AllSettled: {
        await Promise.allSettled(startBranches());
        break;
      }
      case ParallelStepStrategy.FirstSettled: {
        await Promise.race(startBranches()).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.FirstCompleted: {
        await firstCompleted(startBranches());
        break;
      }
    }
  }

  protected ensureNotStopped(stepExecution: IStepExecution) {
    if (stepExecution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
