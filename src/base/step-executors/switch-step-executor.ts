import {
  IFlowExecutionContext,
  IStepExecution,
  IStepExecutor,
} from "../../abstraction";
import { SwitchCase, SwitchStepDef } from "../step-defs";
import { StepStoppedError } from "../step-execution";

export class SwitchStepExecutor implements IStepExecutor<SwitchStepDef> {
  async execute(execution: IStepExecution<SwitchStepDef>): Promise<any> {
    this.ensureNotStopped(execution);

    const { client, stepDef, context } = execution;

    const selected = await stepDef.selector(context);
    const matchedCase = await this.findMatchingCase(
      stepDef.cases,
      selected,
      context
    );
    const branchFlow = matchedCase?.flow ?? stepDef.defaultBranch?.flow;
    const branchCtx = matchedCase?.adapt
      ? await matchedCase.adapt(context)
      : context;

    if (!branchFlow) return;

    const flowExecution = client.createFlowExecution(branchFlow, branchCtx);

    execution.onStopRequested(() => flowExecution.requestStop());

    await flowExecution.start();

    this.ensureNotStopped(execution);
  }

  protected async findMatchingCase<
    TContext extends IFlowExecutionContext,
    TValue
  >(
    cases: SwitchCase<TContext, any, TValue>[],
    value: TValue,
    context: TContext
  ): Promise<SwitchCase<TContext, any, TValue> | undefined> {
    for (const currentCase of cases) {
      if (await currentCase.predicate(value, context)) {
        return currentCase;
      }
    }
  }

  protected ensureNotStopped(execution: IStepExecution) {
    if (execution.isStopRequested()) {
      throw new StepStoppedError();
    }
  }
}
