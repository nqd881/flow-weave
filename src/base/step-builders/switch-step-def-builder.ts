import type { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import type { FlowDefBuilder } from "../flow-def-builder";
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
  TBuilderClient,
  TContext extends IFlowExecutionContext,
  TValue,
> implements IStepDefBuilder<SwitchStepDef<TContext, TValue>> {
  protected branches: SwitchCase<TContext, any, TValue>[] = [];
  protected defaultBranch?: Branch<TContext>;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TBuilderClient, TContext>,
    protected readonly builderClient: TBuilderClient,
    protected readonly selector: Selector<TContext, TValue>,
  ) {}

  case<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    matchValue: TValue,
    caseFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ) {
    return this.caseWhen(
      (selected) => selected === matchValue,
      caseFlow,
      adapt,
    );
  }

  caseWhen<
    TBranchContext extends IFlowExecutionContext = IFlowExecutionContext,
  >(
    predicate: Predicate<TContext, TValue>,
    caseFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof caseFlow !== "function") {
      this.branches.push({
        predicate,
        flow: caseFlow,
        adapt,
      });

      return this;
    }

    const branch = caseFlow(this.builderClient);

    return this.caseWhen(predicate, branch, adapt);
  }

  default<TBranchContext extends IFlowExecutionContext = IFlowExecutionContext>(
    defaultFlow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof defaultFlow !== "function") {
      this.defaultBranch = {
        flow: defaultFlow,
        adapt,
      };

      return this;
    }

    const branch = defaultFlow(this.builderClient);

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
