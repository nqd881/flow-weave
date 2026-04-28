import { IFlowExecution, IStepExecution, IStepExecutor } from "../../../contracts";
import { ParallelStepDef } from "../../../flow/step-defs";
import { ParallelExecutionCoordinator } from "../../execution/parallel-execution-coordinator";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class ParallelStepExecutor implements IStepExecutor<ParallelStepDef> {
  async execute(stepExecution: IStepExecution<ParallelStepDef>): Promise<any> {
    const { stepDef, context } = stepExecution;

    const branchExecutions: IFlowExecution[] = [];

    for (const branch of stepDef.branches) {
      const branchContext = branch.adapt
        ? await branch.adapt(context)
        : context;

      const branchExecution = stepExecution.createChildFlowExecution(
        branch.flow,
        branchContext,
      );

      branchExecutions.push(branchExecution);
    }
    
    throwIfStopRequested(stepExecution);

    await new ParallelExecutionCoordinator(
      branchExecutions,
      stepDef.strategy,
    ).run();
  }
}
