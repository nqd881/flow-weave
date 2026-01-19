import type { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import type { FlowDefBuilder, IFlowBuilderClient } from "../flow-def-builder";
import { SwitchCase, SwitchStepDef } from "../step-defs";
import {
  Branch,
  BranchAdapter,
  FlowFactory,
  Predicate,
  Selector,
} from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class SwitchStepDefBuilder<
  TClient extends IFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TValue
> implements IStepDefBuilder<SwitchStepDef<TContext, TValue>>
{
  protected branches: SwitchCase<TContext, any, TValue>[] = [];
  protected defaultBranch?: Branch<TContext>;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TClient, TContext>,
    protected readonly client: TClient,
    protected readonly selector: Selector<TContext, TValue>
  ) {}

  case<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    matchValue: TValue,
    provider: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>
  ) {
    return this.caseWhen(
      (selected) => selected === matchValue,
      provider,
      adapt
    );
  }

  caseWhen<
    TBranchContext extends IFlowExecutionContext = IFlowExecutionContext
  >(
    predicate: Predicate<TContext, TValue>,
    provider: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>
  ): this {
    if (typeof provider !== "function") {
      this.branches.push({
        predicate,
        flow: provider,
        adapt,
      });

      return this;
    }

    const branch = provider(this.client);

    return this.caseWhen(predicate, branch, adapt);
  }

  default<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    provider: IFlowDef<TBranchContext> | FlowFactory<TClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>
  ): this {
    if (typeof provider !== "function") {
      this.defaultBranch = {
        flow: provider,
        adapt,
      };

      return this;
    }

    const branch = provider(this.client);

    return this.default(branch, adapt);
  }

  end() {
    return this.parentBuilder;
  }

  build(): SwitchStepDef<TContext, TValue> {
    if (!this.branches.length && !this.defaultBranch) {
      throw new Error("Switch step must have at least one branch.");
    }

    return new SwitchStepDef(this.selector, this.branches, this.defaultBranch);
  }
}
