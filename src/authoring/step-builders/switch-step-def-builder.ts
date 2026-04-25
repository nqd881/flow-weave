import type {
  IFlowDef,
  IFlowContext,
} from "../../contracts";
import type { FlowDefBuilder } from "../flow-def-builder";
import { FlowDefFactory } from "../flow-def-factory";
import { SwitchBranchRequiredError } from "../authoring-errors";
import { StepDefMetadata, SwitchCase, SwitchStepDef } from "../../flow/step-defs";
import {
  Branch,
  ContextAdapter,
  Predicate,
  Selector,
} from "../../flow/types";
import { IStepDefBuilder } from "./step-def-builder";

export class SwitchStepDefBuilder<
  TWeaver,
  TContext extends IFlowContext,
  TValue,
  TParentBuilder extends FlowDefBuilder<TWeaver, TContext> = FlowDefBuilder<TWeaver, TContext>,
> implements IStepDefBuilder<SwitchStepDef<TContext, TValue>> {
  protected cases: SwitchCase<TContext, any, TValue>[] = [];
  protected defaultBranch?: Branch<TContext>;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly weaver: TWeaver,
    protected readonly selector: Selector<TContext, TValue>,
  ) {}

  case<TBranchContext extends IFlowContext = IFlowContext>(
    matchValue: TValue,
    caseFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext>,
  ) {
    return this.caseWhen(
      (selected) => selected === matchValue,
      caseFlow,
      adapt,
    );
  }

  caseWhen<
    TBranchContext extends IFlowContext = IFlowContext,
  >(
    predicate: Predicate<TContext, TValue>,
    caseFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof caseFlow !== "function") {
      this.cases.push({
        predicate,
        flow: caseFlow,
        adapt,
      });

      return this;
    }

    const branch = caseFlow(this.weaver);

    return this.caseWhen(predicate, branch, adapt);
  }

  default<TBranchContext extends IFlowContext = IFlowContext>(
    defaultFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext>,
  ): this {
    if (typeof defaultFlow !== "function") {
      this.defaultBranch = {
        flow: defaultFlow,
        adapt,
      };

      return this;
    }

    const branch = defaultFlow(this.weaver);

    return this.default(branch, adapt);
  }

  end(): TParentBuilder {
    return this.parentBuilder;
  }

  build(metadata?: StepDefMetadata<TContext>): SwitchStepDef<TContext, TValue> {
    if (!this.cases.length && !this.defaultBranch) {
      throw new SwitchBranchRequiredError();
    }

    return new SwitchStepDef(
      this.selector,
      this.cases,
      this.defaultBranch,
      metadata,
    );
  }
}
