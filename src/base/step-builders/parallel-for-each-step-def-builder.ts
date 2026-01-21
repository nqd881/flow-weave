import { IFlowDef, IFlowExecutionContext } from "../../abstraction";
import { FlowDefBuilder } from "../flow-def-builder";
import { ParallelForEachStepDef } from "../step-defs";
import { ParallelStepStrategy } from "../types";
import { BranchAdapter, FlowFactory, Selector } from "../types";
import { IStepDefBuilder } from "./step-def-builder";

export class ParallelForEachStepDefBuilder<
  TBuilderClient,
  TContext extends IFlowExecutionContext,
  TItem = unknown,
> implements IStepDefBuilder<ParallelForEachStepDef<TContext, any, TItem>> {
  protected strategy: ParallelStepStrategy = ParallelStepStrategy.AllSettled;
  protected itemFlow: IFlowDef<any>;
  protected adapt?: BranchAdapter<TContext, any, [TItem]>;

  constructor(
    protected readonly parentBuilder: FlowDefBuilder<TBuilderClient, TContext>,
    protected readonly builderClient: TBuilderClient,
    protected readonly itemsSelector: Selector<TContext, TItem[]>,
  ) {}

  run(
    flow: IFlowDef<TContext> | FlowFactory<TBuilderClient, TContext>,
    adapt?: BranchAdapter<TContext, TContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this;
  run<TBranchContext extends IFlowExecutionContext>(
    flow:
      | IFlowDef<TBranchContext>
      | FlowFactory<TBuilderClient, TBranchContext>,
    adapt?: BranchAdapter<TContext, TBranchContext, [TItem]>,
  ): this {
    if (typeof flow !== "function") {
      this.itemFlow = flow;
      this.adapt = adapt;

      return this;
    }

    this.itemFlow = flow(this.builderClient);
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

  firstSuccess() {
    this.strategy = ParallelStepStrategy.FirstSuccess;
    return this;
  }

  join() {
    return this.parentBuilder;
  }

  build(id?: string) {
    return new ParallelForEachStepDef(
      this.itemsSelector,
      this.itemFlow,
      this.adapt,
      this.strategy,
      id,
    );
  }
}
