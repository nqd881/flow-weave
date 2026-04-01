import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder } from "../flow-def-builder";
import { ParallelForEachStepDef, StepOptions } from "../step-defs";
import { ParallelStepStrategy } from "../types";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelForEachStepDefBuilder<
  TFlowBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown,
  TParentBuilder extends FlowDefBuilder<TFlowBuilderClient, TContext> = FlowDefBuilder<TFlowBuilderClient, TContext>,
> implements IStepDefBuilder<ParallelForEachStepDef<TContext, any, TItem>> {
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;
  protected itemFlow: IFlowDef<any>;
  protected adapt?: BranchAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: TParentBuilder,
    protected readonly flowBuilderClient: TFlowBuilderClient,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
    protected readonly stepId?: string,
    protected readonly stepOptions?: StepOptions<TContext>,
  ) {}

  run(
    flow: IFlowDef<TContext> | FlowFactory<TFlowBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TFlowBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this {
    if (typeof flow !== "function") {
      this.itemFlow = flow;
      this.adapt = adapt;

      return this;
    }

    this.itemFlow = flow(this.flowBuilderClient);
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
      id ?? this.stepId,
      this.stepOptions,
    );
  }
}
