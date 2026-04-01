import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { ParallelStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";
import { ParallelStepStrategy } from "../types";
import { firstCompleted, mapStop } from "../utils";

export class ParallelStepExecutor implements IStepExecutor<ParallelStepDef> {
  async execute(stepExecution: IStepExecution<ParallelStepDef>): Promise<any> {
    const { client, stepDef, context } = stepExecution;

    const branchExecutions: IFlowExecution[] = [];

    for (const branch of stepDef.branches) {
      const branchContext = branch.adapt
        ? await branch.adapt(context)
        : context;

      const branchExecution = client.createFlowExecution(
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

    this.ensureNotStopped(stepExecution);

    const startBranches = () =>
      branchExecutions.map((branchExecution) => branchExecution.start());

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
