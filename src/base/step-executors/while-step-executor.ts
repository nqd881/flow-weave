import { IStepExecution, IStepExecutor } from "../../abstraction";
import { WhileStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";

export class WhileStepExecutor implements IStepExecutor<WhileStepDef> {
  async execute(execution: IStepExecution<WhileStepDef>): Promise<any> {
    const { client, stepDef, context } = execution;

    while (await stepDef.condition(context)) {
      this.ensureNotStopped(execution);

      const branchContext = stepDef.adapt
        ? await stepDef.adapt(context)
        : context;

      const flowExecution = client.createFlowExecution(
        stepDef.body,
        branchContext
      );

      execution.onStopRequested(() => flowExecution.requestStop());

      await flowExecution.start();

      this.ensureNotStopped(execution);
    }
  }

  protected ensureNotStopped(execution: IStepExecution) {
    if (execution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
