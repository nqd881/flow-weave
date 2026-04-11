import { IFlowDef, IFlowContext } from "../../contracts";
import { FlowDefBuilder } from "../flow-def-builder";
import { FlowDefFactory } from "../flow-def-factory";
import { BaseStepDefBuilder } from "./base-step-def-builder";
import { ForEachStepDef } from "../../flow/step-defs";
import { ContextAdapter, Selector } from "../../flow/types";

export class ForEachStepDefBuilder<
  TWeaver,
  TContext extends IFlowContext,
  TItem = unknown,
  TParentBuilder extends FlowDefBuilder<TWeaver, TContext> = FlowDefBuilder<TWeaver, TContext>,
> extends BaseStepDefBuilder<TContext, ForEachStepDef<TContext, any, TItem>> {
  protected itemFlow: IFlowDef<any>;
  protected adapt?: ContextAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly weaver: TWeaver,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
    protected readonly stepId?: string,
  ) {
    super();
  }

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

  build(id?: string) {
    if (!this.itemFlow) {
      throw new Error("ForEach step requires run(...) before build.");
    }

    return new ForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      { id: id ?? this.stepId, hooks: this.stepHooks },
    );
  }
}
