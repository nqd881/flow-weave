import { IFlowDef, IFlowContext } from "../../../contracts";
import { FlowDefBuilder } from "../flow-def-builder";
import { FlowDefFactory } from "../flow-def-factory";
import { IStepDefBuilder } from "./step-def-builder";
import { ForEachRunRequiredError } from "../../validation-errors";
import { ForEachStepDef, StepDefMetadata } from "../../../flow/step-defs";
import { ContextAdapter, Selector } from "../../../flow/types";

export class ForEachStepDefBuilder<
  TWeaver,
  TContext extends IFlowContext,
  TItem = unknown,
  TParentBuilder extends FlowDefBuilder<TWeaver, TContext> = FlowDefBuilder<TWeaver, TContext>,
> implements IStepDefBuilder<ForEachStepDef<TContext, any, TItem>> {
  protected itemFlow: IFlowDef<any>;
  protected adapt?: ContextAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly weaver: TWeaver,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
  ) {}

  run(
    itemFlow: IFlowDef<TContext> | FlowDefFactory<TWeaver, TContext>,
    adapt?: ContextAdapter<TContext, TContext, [TItem]>,
  ): TParentBuilder;
  run<TBranchContext extends IFlowContext>(
    itemFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt: ContextAdapter<TContext, TBranchContext, [TItem]>,
  ): TParentBuilder;
  run<TBranchContext extends IFlowContext>(
    itemFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext, [TItem]>,
  ): TParentBuilder {
    if (typeof itemFlow !== "function") {
      this.itemFlow = itemFlow;
      this.adapt = adapt;

      return this.parentBuilder;
    }

    this.itemFlow = itemFlow(this.weaver);
    this.adapt = adapt;

    return this.parentBuilder;
  }

  build(metadata?: StepDefMetadata<TContext>) {
    if (!this.itemFlow) {
      throw new ForEachRunRequiredError();
    }

    return new ForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      metadata,
    );
  }
}
