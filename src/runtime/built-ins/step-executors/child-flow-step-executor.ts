import { IStepExecution, IStepExecutor } from "../../../contracts";
import { ChildFlowStepDef } from "../../../flow/step-defs";
import { throwIfStopRequested } from "../internal/throw-if-stop-requested";

export class ChildFlowStepExecutor implements IStepExecutor<ChildFlowStepDef> {
  async execute(stepExecution: IStepExecution<ChildFlowStepDef>): Promise<any> {
    const { stepDef, context } = stepExecution;

    const childContext = stepDef.adapt
      ? await stepDef.adapt(context)
      : context;

    const childExecution = stepExecution.createChildFlowExecution(
      stepDef.childFlow,
      childContext,
    );

    throwIfStopRequested(stepExecution);

    await childExecution.start();
  }
}
