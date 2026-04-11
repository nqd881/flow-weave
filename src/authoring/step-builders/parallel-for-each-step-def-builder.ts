import { IFlowDef, IFlowContext } from "../../contracts";
import { FlowDefBuilder } from "../flow-def-builder";
import { FlowDefFactory } from "../flow-def-factory";
import { BaseStepDefBuilder } from "./base-step-def-builder";
import { ParallelForEachStepDef } from "../../flow/step-defs";
import { ParallelStepStrategy } from "../../flow/types";
import { ContextAdapter, Selector } from "../../flow/types";

export class ParallelForEachStepDefBuilder<
  TWeaver,
  TContext extends IFlowContext,
  TItem = unknown,
  TParentBuilder extends FlowDefBuilder<TWeaver, TContext> = FlowDefBuilder<TWeaver, TContext>,
> extends BaseStepDefBuilder<TContext, ParallelForEachStepDef<TContext, any, TItem>> {
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;
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
  ): this;
  run<TBranchContext extends IFlowContext>(
    itemFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt: ContextAdapter<TContext, TBranchContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowContext>(
    itemFlow:
      | IFlowDef<TBranchContext>
      | FlowDefFactory<TWeaver, TBranchContext>,
    adapt?: ContextAdapter<TContext, TBranchContext, [TItem]>,
  ): this {
    if (typeof itemFlow !== "function") {
      this.itemFlow = itemFlow;
      this.adapt = adapt;

      return this;
    }

    this.itemFlow = itemFlow(this.weaver);
    this.adapt = adapt;

    return this;
  }

  allSettled() {
    this.strategy = ParallelStepStrategy.AllSettled;
    return this;
  }

  failFast() {
    this.strategy = ParallelStepStrategy.FailFast;
    return this;
  }

  firstSettled() {
    this.strategy = ParallelStepStrategy.FirstSettled;
    return this;
  }

  firstCompleted() {
    this.strategy = ParallelStepStrategy.FirstCompleted;
    return this;
  }

  join(): TParentBuilder {
    return this.parentBuilder;
  }

  build(id?: string) {
    if (!this.itemFlow) {
      throw new Error("ParallelForEach step requires run(...) before build.");
    }

    return new ParallelForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      this.strategy,
      { id: id ?? this.stepId, hooks: this.stepHooks },
    );
  }
}
