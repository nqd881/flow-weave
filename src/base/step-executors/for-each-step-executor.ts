import { IStepExecution, IStepExecutor } from "../../abstraction";
import { ForEachStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";

export class ForEachStepExecutor implements IStepExecutor<ForEachStepDef> {
  async execute(execution: IStepExecution<ForEachStepDef>): Promise<any> {
    const { client, stepDef, context } = execution;

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      this.ensureNotStopped(execution);

      const branchContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const flowExecution = client.createFlowExecution(
        stepDef.body,
        branchContext
      );

      execution.onStopRequested(() => flowExecution.requestStop());

      await flowExecution.start();
    }
  }

  protected ensureNotStopped(execution: IStepExecution) {
    if (execution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
