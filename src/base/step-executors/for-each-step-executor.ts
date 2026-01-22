import { IStepExecution, IStepExecutor } from "../../abstraction";
import { ForEachStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";
import { mapStop } from "../utils";

export class ForEachStepExecutor implements IStepExecutor<ForEachStepDef> {
  async execute(stepExecution: IStepExecution<ForEachStepDef>): Promise<any> {
    const { client, stepDef, context } = stepExecution;

    const items = await stepDef.itemsSelector(context);

    for (const item of items) {
      this.ensureNotStopped(stepExecution);

      const branchContext = stepDef.adapt
        ? await stepDef.adapt(context, item)
        : context;

      const branchExecution = client.createFlowExecution(
        stepDef.itemFlow,
        branchContext,
      );

      stepExecution.onStopRequested(() => branchExecution.requestStop());

      await branchExecution.start().catch(mapStop);
    }
  }

  protected ensureNotStopped(stepExecution: IStepExecution) {
    if (stepExecution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
