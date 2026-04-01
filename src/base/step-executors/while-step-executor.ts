import { IStepExecution, IStepExecutor } from "../../abstraction";
import { WhileStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";
import { mapStop } from "../utils";

export class WhileStepExecutor implements IStepExecutor<WhileStepDef> {
  async execute(stepExecution: IStepExecution<WhileStepDef>): Promise<any> {
    const { client, stepDef, context } = stepExecution;

    while (await stepDef.condition(context)) {
      const iterationCtx = stepDef.adapt
        ? await stepDef.adapt(context)
        : context;

      const iterationExecution = client.createFlowExecution(
        stepDef.iterationFlow,
        iterationCtx,
      );

      stepExecution.onStopRequested(() => iterationExecution.requestStop());

      this.ensureNotStopped(stepExecution);

      await iterationExecution.start().catch(mapStop);
    }
  }

  protected ensureNotStopped(stepExecution: IStepExecution) {
    if (stepExecution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
