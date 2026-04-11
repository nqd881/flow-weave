import { IStepExecution, IStepExecutor } from "../../contracts";
import { WhileStepDef } from "../step-defs";
import { mapStop } from "../utils";

export class WhileStepExecutor implements IStepExecutor<WhileStepDef> {
  async execute(stepExecution: IStepExecution<WhileStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    while (await stepDef.condition(context)) {
      const iterationCtx = stepDef.adapt
        ? await stepDef.adapt(context)
        : context;

      const iterationExecution = runtime.createFlowExecution(
        stepDef.iterationFlow,
        iterationCtx,
      );

      stepExecution.onStopRequested(() => iterationExecution.requestStop());

      stepExecution.throwIfStopRequested();

      await iterationExecution.start().catch(mapStop);
    }
  }
}
