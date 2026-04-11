import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../contracts";
import { ParallelStepDef } from "../step-defs";
import { ParallelStepStrategy } from "../types";
import { firstCompleted, mapStop } from "../utils";

export class ParallelStepExecutor implements IStepExecutor<ParallelStepDef> {
  async execute(stepExecution: IStepExecution<ParallelStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    const branchExecutions: IFlowExecution[] = [];

    for (const branch of stepDef.branches) {
      const branchContext = branch.adapt
        ? await branch.adapt(context)
        : context;

      const branchExecution = runtime.createFlowExecution(
        branch.flow,
        branchContext,
      );

      branchExecutions.push(branchExecution);
    }

    stepExecution.onStopRequested(() => {
      branchExecutions.forEach((branchExecution) => {
        branchExecution.requestStop();
      });
    });

    stepExecution.throwIfStopRequested();

    const branchStarts = branchExecutions.map((branchExecution) =>
      branchExecution.start(),
    );

    switch (stepDef.strategy) {
      case ParallelStepStrategy.FailFast: {
        await Promise.all(branchStarts).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.AllSettled: {
        await Promise.allSettled(branchStarts);
        break;
      }
      case ParallelStepStrategy.FirstSettled: {
        await Promise.race(branchStarts).catch(mapStop);
        break;
      }
      case ParallelStepStrategy.FirstCompleted: {
        await firstCompleted(branchStarts);
        break;
      }
    }
  }
}
