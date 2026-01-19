import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { ParallelStepStrategy } from "../step-defs/parallel-step-def";
import { ParallelForEachStepDef } from "../step-defs/parallel-for-each-step-def";
import { StepStoppedError } from "../step-execution";

export class ParallelForEachStepExecutor
  implements IStepExecutor<ParallelForEachStepDef>
{
  async execute(
    execution: IStepExecution<ParallelForEachStepDef>
  ): Promise<any> {
    const { client, stepDef, context } = execution;

    const flowExecutions: IFlowExecution[] = [];

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      this.ensureNotStopped(execution);

      const itemContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const flowExecution = client.createFlowExecution(
        stepDef.body,
        itemContext
      );

      flowExecutions.push(flowExecution);
    }

    const start = () => flowExecutions.map((fe) => fe.start());

    switch (stepDef.strategy) {
      case ParallelStepStrategy.FailFast: {
        await Promise.all(start());
        break;
      }
      case ParallelStepStrategy.FirstCompleted: {
        await Promise.race(start());
        break;
      }
      case ParallelStepStrategy.CollectAll:
      default: {
        await Promise.allSettled(start());
        break;
      }
    }

    this.ensureNotStopped(execution);
  }

  protected toAsyncIterable<T>(
    items: Iterable<T> | AsyncIterable<T>
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

  protected ensureNotStopped(execution: IStepExecution) {
    if (execution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
