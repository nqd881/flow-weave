import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { ParallelStepDef, ParallelStepStrategy } from "../step-defs";

export class ParallelStepExecutor implements IStepExecutor<ParallelStepDef> {
  async execute(execution: IStepExecution<ParallelStepDef>): Promise<any> {
    const { client, stepDef, context } = execution;

    const flowExecutions: IFlowExecution[] = [];

    for (const branch of stepDef.branches) {
      const branchContext = branch.adapt
        ? await branch.adapt(context)
        : context;

      const fe = client.createFlowExecution(branch.flow, branchContext);

      flowExecutions.push(fe);
    }

    execution.onStopRequested(() => {
      flowExecutions.forEach((fe) => {
        fe.requestStop();
      });
    });

    const start = () => flowExecutions.map((fe) => fe.start());

    switch (stepDef.strategy) {
      case ParallelStepStrategy.CollectAll: {
        await Promise.allSettled(start());
        break;
      }
      case ParallelStepStrategy.FailFast: {
        await Promise.all(start());
        break;
      }
      case ParallelStepStrategy.FirstCompleted: {
        await Promise.race(start());
        break;
      }
    }
  }
}
