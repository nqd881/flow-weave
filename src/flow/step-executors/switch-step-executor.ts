import {
  IFlowContext,
  IStepExecution,
  IStepExecutor,
} from "../../contracts";
import { SwitchCase, SwitchStepDef } from "../step-defs";
import { mapStop } from "../utils";

export class SwitchStepExecutor implements IStepExecutor<SwitchStepDef> {
  async execute(stepExecution: IStepExecution<SwitchStepDef>): Promise<any> {
    const { runtime, stepDef, context } = stepExecution;

    const selected = await stepDef.selector(context);
    const matchedCase = await this.findMatchingCase(
      stepDef.cases,
      selected,
      context,
    );
    const branchFlow = matchedCase?.flow ?? stepDef.defaultBranch?.flow;

    if (!branchFlow) {
      return;
    }

    const branchCtx = matchedCase?.adapt
      ? await matchedCase.adapt(context)
      : context;

    const branchExecution = runtime.createFlowExecution(branchFlow, branchCtx);

    stepExecution.onStopRequested(() => branchExecution.requestStop());

    stepExecution.throwIfStopRequested();

    await branchExecution.start().catch(mapStop);
  }

  protected async findMatchingCase<
    TContext extends IFlowContext,
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
}
