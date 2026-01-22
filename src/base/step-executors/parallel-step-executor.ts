import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { ParallelStepDef } from "../step-defs";
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

      const fe = client.createFlowExecution(branch.flow, branchContext);

      branchExecutions.push(fe);
    }

    stepExecution.onStopRequested(() => {
      branchExecutions.forEach((fe) => {
        fe.requestStop();
      });
    });

    const starts = branchExecutions.map((fe) => fe.start());

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
  }
}
