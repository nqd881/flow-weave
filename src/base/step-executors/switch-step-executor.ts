import {
  IFlowExecutionContext,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { SwitchCase, SwitchStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";
import { mapStop } from "../utils";

export class SwitchStepExecutor implements IStepExecutor<SwitchStepDef> {
  async execute(stepExecution: IStepExecution<SwitchStepDef>): Promise<any> {
    this.ensureNotStopped(stepExecution);

    const { client, stepDef, context } = stepExecution;

    const selected = await stepDef.selector(context);
    const matchedCase = await this.findMatchingCase(
      stepDef.cases,
      selected,
      context,
    );
    const branchFlow = matchedCase?.flow ?? stepDef.defaultBranch?.flow;
    const branchCtx = matchedCase?.adapt
      ? await matchedCase.adapt(context)
      : context;

    if (!branchFlow) return;

    const branchExecution = client.createFlowExecution(branchFlow, branchCtx);

    stepExecution.onStopRequested(() => branchExecution.requestStop());

    await branchExecution.start().catch(mapStop);

    this.ensureNotStopped(stepExecution);
  }

  protected async findMatchingCase<
    TContext extends IFlowExecutionContext,
    TValue,
  >(
    cases: SwitchCase<TContext, any, TValue>[],
    value: TValue,
    context: TContext,
  ): Promise<SwitchCase<TContext, any, TValue> | undefined> {
    for (const currentCase of cases) {
      if (await currentCase.predicate(value, context)) {
        return currentCase;
      }
    }
  }

  protected ensureNotStopped(stepExecution: IStepExecution) {
    if (stepExecution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
