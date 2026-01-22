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
      this.ensureNotStopped(stepExecution);

      const itemContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const itemExecution = client.createFlowExecution(
        stepDef.itemFlow,
        itemContext,
      );

      itemExecutions.push(itemExecution);
    }

    const starts = itemExecutions.map((fe) => fe.start());

    switch (stepDef.strategy) {
      case ParallelStepStrategy.FailFast: {
        await Promise.all(starts).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.AllSettled: {
        await Promise.allSettled(starts);
        break;
      }
      case ParallelStepStrategy.FirstSettled: {
        await Promise.race(starts).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.FirstCompleted: {
        await firstCompleted(starts);
        break;
      }
    }

    this.ensureNotStopped(stepExecution);
  }

  protected toAsyncIterable<T>(
    items: Iterable<T> | AsyncIterable<T>,
  ): AsyncIterable<T> {
    if (typeof (items as any)[Symbol.asyncIterator] === "function") {
      return items as AsyncIterable<T>;
    }

    return (async function* () {
      for (const item of items as Iterable<T>) {
        yield item;
      }
    })();
  }

  protected ensureNotStopped(stepExecution: IStepExecution) {
    if (stepExecution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
