import {
  IFlowExecution,
  IStepExecution,
  IStepExecutor,
} from "../../contracts";
import { ParallelStepDef } from "../step-defs";
import { coordinateParallelExecutions } from "../parallel-execution-utils";

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

    await coordinateParallelExecutions(branchExecutions, stepDef.strategy);
  }
}
