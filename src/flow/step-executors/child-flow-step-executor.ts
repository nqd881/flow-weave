import { IStepExecution, IStepExecutor } from "../../contracts";
import { ChildFlowStepDef } from "../step-defs";
import { mapStop } from "../utils";

export class ChildFlowStepExecutor implements IStepExecutor<ChildFlowStepDef> {
  async execute(stepExecution: IStepExecution<ChildFlowStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    const childContext = stepDef.adapt
      ? await stepDef.adapt(context)
      : context;

    const childExecution = runtime.createFlowExecution(
      stepDef.childFlow,
      childContext,
    );

    stepExecution.onStopRequested(() => childExecution.requestStop());

    stepExecution.throwIfStopRequested();

    await childExecution.start().catch(mapStop);
  }
}
