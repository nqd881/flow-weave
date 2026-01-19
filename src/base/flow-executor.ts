import {
  IFlowDef,
  IFlowExecution,
  IFlowExecutionContext,
  IFlowExecutor,
  IStepDef,
  IStepExecution,
  IStepExecutor,
} from "../abstraction";
import { IClient } from "../abstraction/client";
import {
  ForEachStepDef,
  ParallelForEachStepDef,
  ParallelStepDef,
  SwitchStepDef,
  TaskStepDef,
  WhileStepDef,
} from "./step-defs";
import { StepExecution } from "./step-execution";
import {
  ForEachStepExecutor,
  ParallelForEachStepExecutor,
  ParallelStepExecutor,
  SwitchStepExecutor,
  TaskStepExecutor,
  WhileStepExecutor,
} from "./step-executors";

export class FlowExecutor<TFlow extends IFlowDef>
  implements IFlowExecutor<TFlow>
{
  createStepExecution(
    client: IClient,
    step: IStepDef,
    context: IFlowExecutionContext
  ): IStepExecution {
    return new StepExecution(
      client,
      this.resolveStepExecutor(step),
      step,
      context
    );
  }

  async execute(flowExecution: IFlowExecution<TFlow>): Promise<any> {
    const { client, flowDef, context } = flowExecution;

    let stopRequested = false;
    let currentStepExecution: IStepExecution | undefined;

    flowExecution.onStopRequested(() => {
      stopRequested = true;

      currentStepExecution?.requestStop();
    });

    for (const stepDef of flowDef.steps) {
      if (stopRequested) break;

      const stepExecution = this.createStepExecution(client, stepDef, context);

      try {
        this.beforeStepStart(flowExecution, stepExecution);

        currentStepExecution = stepExecution;

        await stepExecution.start();
      } finally {
        this.afterStepFinished(flowExecution, stepExecution);
      }
    }
  }

  resolveStepExecutor<TStep extends IStepDef>(
    stepDef: TStep
  ): IStepExecutor<TStep> {
    const executor = (() => {
      switch (true) {
        case stepDef instanceof TaskStepDef: {
          return new TaskStepExecutor();
        }
        case stepDef instanceof ParallelStepDef: {
          return new ParallelStepExecutor();
        }
        case stepDef instanceof WhileStepDef: {
          return new WhileStepExecutor();
        }
        case stepDef instanceof SwitchStepDef: {
          return new SwitchStepExecutor();
        }
        case stepDef instanceof ForEachStepDef: {
          return new ForEachStepExecutor();
        }
        case stepDef instanceof ParallelForEachStepDef: {
          return new ParallelForEachStepExecutor();
        }
        default: {
          throw new Error("Invalid step type");
        }
      }
    })();

    return executor as any as IStepExecutor<TStep>;
  }

  beforeStepStart(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution
  ) {}

  afterStepFinished(
    flowExecution: IFlowExecution,
    stepExecution: IStepExecution
  ) {}
}
